import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
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
        this.sessionsDir = path.join(baseDir, 'sessions');
        if (!fs.existsSync(this.sessionsDir)) {
            fs.mkdirSync(this.sessionsDir, { recursive: true });
        }
    }

    protected getWorkspacePath(appId: string, chatId: string): string {
        const workspace = path.join(this.sessionsDir, appId, chatId);
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

        // Sync global auth state to isolated workspace so agent recognizes user
        const globalHome = path.join(os.homedir(), '.gemini');
        const authFiles = ['google_accounts.json', 'oauth_creds.json', 'settings.json', 'installation_id'];
        let syncCount = 0;
        for (const file of authFiles) {
            const src = path.join(globalHome, file);
            if (fs.existsSync(src)) {
                try {
                    fs.copyFileSync(src, path.join(dotGemini, file));
                    syncCount++;
                } catch (e) {}
            }
        }

        const key = `${options.appId}:${options.chatId}`;
        const mode = options.runMode || 'auto';

        // 构建命令
        let approvalArg = '--yolo'; // Default YOLO
        let cmdSuffix = '';
        let resumeArg = '';

        if (mode === 'plan') {
            approvalArg = '--approval-mode default'; // Strict/Default for planning
            cmdSuffix = ' (Please only output a detailed execution plan text. Do not execute any tools yet.)';
            resumeArg = ''; // Always start a fresh session for planning to ensure isolation
        } else {
            resumeArg = '--resume latest'; // Resume the plan session for actual execution
        }

        // 核心参数
        let cmd = `gemini ${approvalArg} ${resumeArg} --include-directories "${options.projectRoot}" -p "${options.command.replace(/"/g, '\\"')}${cmdSuffix}"`;

        if (!options.silent) {
            Dashboard.logEvent('EXE', `Running [${mode}]: ${options.command.substring(0, 30)}...`);
        }

        return new Promise((resolve) => {
            const child = spawn(cmd, {
                cwd: options.projectRoot, // 必须在项目根目录运行，否则 Agent 无法找到文件
                env: { 
                    ...process.env, 
                    // 依然将历史记录和配置隔离在 session 目录中
                    GEMINI_CLI_HOME: workspace 
                },
                shell: true
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