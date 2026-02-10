import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { Dashboard } from '../ui/dashboard';

export interface ExecutionResult {
    code: number | null;
    stdout: string;
    stderr: string;
}

export interface ExecuteOptions {
    appId: string;
    chatId: string;
    command: string;
    projectRoot: string;
    silent?: boolean;
    runMode?: 'plan' | 'auto';
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
    onApprovalRequired?: (prompt: string) => void;
}

export interface IAgentExecutor {
    run(options: ExecuteOptions): Promise<ExecutionResult>;
    respond(appId: string, chatId: string, input: string): void;
    dispose(): void;
}

abstract class BaseExecutor implements IAgentExecutor {
    protected sessionsDir: string;
    protected runningProcesses: Map<string, ChildProcess> = new Map();

    constructor(baseDir: string) {
        this.sessionsDir = path.join(os.homedir(), '.agentsocial', 'sessions');
        if (!fs.existsSync(this.sessionsDir)) {
            fs.mkdirSync(this.sessionsDir, { recursive: true });
        }
    }

    protected getWorkspacePath(appId: string, chatId: string): string {
        // Hash chatId to prevent path traversal attacks
        const safeChatId = crypto.createHash('md5').update(chatId).digest('hex');
        const workspace = path.join(this.sessionsDir, appId, safeChatId);
        if (!fs.existsSync(workspace)) fs.mkdirSync(workspace, { recursive: true });
        return workspace;
    }

    abstract run(options: ExecuteOptions): Promise<ExecutionResult>;

    respond(appId: string, chatId: string, input: string) {
        const key = `${appId}:${chatId}`;
        const cp = this.runningProcesses.get(key);
        if (cp && cp.stdin) {
            Dashboard.logEvent('EXE', `Injecting reply: ${input}`);
            cp.stdin.write(`${input}\n`);
        }
    }

    dispose() {
        for (const cp of this.runningProcesses.values()) cp.kill();
        this.runningProcesses.clear();
    }
}

export class GeminiExecutor extends BaseExecutor {
    async run(options: ExecuteOptions): Promise<ExecutionResult> {
        const workspace = this.getWorkspacePath(options.appId, options.chatId);
        const dotGemini = path.join(workspace, '.gemini');
        if (!fs.existsSync(dotGemini)) fs.mkdirSync(dotGemini, { recursive: true });

        // Sync global auth state to isolated workspace using symlinks (not copies)
        // This prevents credential sprawl - only one copy of sensitive files exists
        const globalHome = path.join(os.homedir(), '.gemini');
        const authFiles = ['google_accounts.json', 'oauth_creds.json', 'settings.json', 'installation_id'];
        let syncCount = 0;
        for (const file of authFiles) {
            const src = path.join(globalHome, file);
            const dest = path.join(dotGemini, file);
            if (fs.existsSync(src) && !fs.existsSync(dest)) {
                try {
                    // Use symlink instead of copy to avoid credential sprawl
                    fs.symlinkSync(src, dest, 'file');
                    syncCount++;
                } catch (e: any) {
                    // Fallback to copy if symlink fails (e.g., Windows without admin rights)
                    if (e.code === 'EPERM' || e.code === 'EACCES') {
                        fs.copyFileSync(src, dest);
                        fs.chmodSync(dest, 0o600); // Restrict to owner only
                        syncCount++;
                    }
                }
            }
        }

        const key = `${options.appId}:${options.chatId}`;
        const mode = options.runMode || 'auto';

        // Build command arguments (array-based to prevent injection)
        const args: string[] = [];
        let cmdSuffix = '';

        if (mode === 'plan') {
            args.push('--approval-mode', 'plan'); // Use native read-only mode for planning
            cmdSuffix = ' (Please only output a detailed execution plan text. Do not execute any tools yet.)';
            // Always start a fresh session for planning to ensure isolation
        } else {
            args.push('--yolo'); // YOLO mode for execution
            args.push('--resume', 'latest'); // Resume the plan session
        }

        // Add core arguments
        args.push('--include-directories', options.projectRoot);
        args.push('-p', options.command + cmdSuffix);

        if (!options.silent) {
            Dashboard.logEvent('EXE', `Running [${mode}]: ${options.command.substring(0, 30)}...`);
        }

        return new Promise((resolve) => {
            // Windows compatibility: .cmd files need cmd.exe when shell:false
            let command = 'gemini';
            let finalArgs = args;
            if (process.platform === 'win32') {
                command = 'cmd.exe';
                finalArgs = ['/c', 'gemini', ...args];
            }

            const child = spawn(command, finalArgs, {
                cwd: options.projectRoot, // 必须在项目根目录运行，否则 Agent 无法找到文件
                env: {
                    ...process.env,
                    GEMINI_CLI_HOME: workspace
                },
                shell: false
            });

            this.runningProcesses.set(key, child);

            let stdout = '';
            let stderr = '';

            const checkApproval = (str: string) => {
                if (mode === 'plan') {
                    if (str.includes('(y/n)') || str.includes('Confirm?') || str.includes('Allow tool call')) {
                        Dashboard.logEvent('SYS', 'Found approval prompt in plan mode (unexpected but handled)');
                    }
                }
            };

            child.stdout?.on('data', (d) => {
                const str = d.toString();
                stdout += str;
                if (!options.silent) process.stdout.write(str);
                if (options.onStdout) options.onStdout(str);
                checkApproval(str);
            });

            child.stderr?.on('data', (d) => {
                const str = d.toString();
                stderr += str;
                if (!options.silent) process.stderr.write(str);
                if (options.onStderr) options.onStderr(str);
                checkApproval(str);
            });

            child.on('close', (code) => {
                this.runningProcesses.delete(key);
                resolve({ code, stdout, stderr });
            });
        });
    }
}

export class ExecutorFactory {
    static create(type: string, baseDir: string): IAgentExecutor {
        return new GeminiExecutor(baseDir);
    }
}