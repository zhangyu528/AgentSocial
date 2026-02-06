import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
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
    sandbox?: boolean;
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
        const key = `${options.appId}:${options.chatId}`;
        const mode = options.runMode || 'auto';

        // 构建命令
        let approvalArg = '--yolo'; // Default YOLO
        let cmdSuffix = '';

        if (mode === 'plan') {
            approvalArg = '--approval-mode default'; // Strict/Default for planning
            cmdSuffix = ' (Please only output a detailed execution plan text. Do not execute any tools yet.)';
        }

        // 核心参数
        let cmd = `gemini ${approvalArg} --resume latest --include-directories "${options.projectRoot}" -p "${options.command.replace(/"/g, '\\"')}${cmdSuffix}"`;
        if (options.sandbox) cmd += ' --sandbox';

        Dashboard.logEvent('EXE', `Running [${mode}]: ${options.command.substring(0, 30)}...`);

        return new Promise((resolve) => {
            const child = spawn(cmd, {
                cwd: options.projectRoot,
                env: { ...process.env, OTEL_SDK_DISABLED: 'true' },
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
                process.stdout.write(str);
                if (options.onStdout) options.onStdout(str);
                checkApproval(str);
            });

            child.stderr?.on('data', (d) => {
                const str = d.toString();
                stderr += str;
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