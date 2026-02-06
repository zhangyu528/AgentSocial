import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

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
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
}

export interface IAgentExecutor {
    run(options: ExecuteOptions): Promise<ExecutionResult>;
    dispose(): void;
}

// ---------------------------------------------------------
// BASE ABSTRACT CLASS
// ---------------------------------------------------------
abstract class BaseExecutor implements IAgentExecutor {
    protected sessionsDir: string;

    constructor(baseDir: string) {
        this.sessionsDir = path.join(baseDir, 'sessions');
        if (!fs.existsSync(this.sessionsDir)) {
            fs.mkdirSync(this.sessionsDir, { recursive: true });
        }
    }

    protected getWorkspacePath(appId: string, chatId: string): string {
        const workspace = path.join(this.sessionsDir, appId, chatId);
        if (!fs.existsSync(workspace)) {
            fs.mkdirSync(workspace, { recursive: true });
        }
        return workspace;
    }

    abstract run(options: ExecuteOptions): Promise<ExecutionResult>;

    dispose() {
        // One-shot mode doesn't need persistent cleanup
    }
}

// ---------------------------------------------------------
// GEMINI STANDARD ADAPTER (One-shot)
// ---------------------------------------------------------
export class GeminiExecutor extends BaseExecutor {
    async run(options: ExecuteOptions): Promise<ExecutionResult> {
        const workspace = this.getWorkspacePath(options.appId, options.chatId);
        
        // 构建完整命令行字符串，避免 args 数组在 shell: true 下的解析歧义
        let cmd = `gemini --yolo --resume latest --include-directories "${options.projectRoot}"`;
        if (options.sandbox) cmd += ' --sandbox';
        
        // 处理指令转义：将双引号转为 \", 并用双引号包裹整个指令
        const escapedCommand = options.command.replace(/"/g, '\\"');
        cmd += ` -p "${escapedCommand}"`;

        console.log(`[Gemini] Executing: ${cmd}`);

        return new Promise((resolve) => {
            const child = spawn(cmd, {
                cwd: workspace,
                env: { 
                    ...process.env, 
                    OTEL_SDK_DISABLED: 'true',
                    FEISHU_APP_ID: options.appId,
                    FEISHU_CHAT_ID: options.chatId
                },
                shell: true
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (d) => {
                const str = d.toString();
                stdout += str;
                if (options.onStdout) options.onStdout(str);
            });

            child.stderr.on('data', (d) => {
                const str = d.toString();
                stderr += str;
                if (options.onStderr) options.onStderr(str);
            });

            child.on('close', (code) => {
                // 处理 Session 缺失自动重试
                if (code !== 0 && (stderr.includes("No previous sessions found") || stderr.includes("Error resuming session"))) {
                    console.log("[Gemini] No session found, retrying without resume...");
                    
                    let retryCmd = `gemini --yolo --include-directories "${options.projectRoot}"`;
                    if (options.sandbox) retryCmd += ' --sandbox';
                    retryCmd += ` -p "${options.command.replace(/"/g, '\\"')}"`;

                    const retryChild = spawn(retryCmd, {
                        cwd: workspace,
                        env: { ...process.env, OTEL_SDK_DISABLED: 'true' },
                        shell: true
                    });

                    let rOut = '', rErr = '';
                    retryChild.stdout.on('data', d => { rOut += d.toString(); if (options.onStdout) options.onStdout(d.toString()); });
                    retryChild.stderr.on('data', d => { rErr += d.toString(); if (options.onStderr) options.onStderr(d.toString()); });
                    retryChild.on('close', (rCode) => resolve({ code: rCode, stdout: rOut, stderr: rErr }));
                } else {
                    resolve({ code, stdout, stderr });
                }
            });
        });
    }
}

// ---------------------------------------------------------
// FACTORY
// ---------------------------------------------------------
export class ExecutorFactory {
    static create(type: string, baseDir: string): IAgentExecutor {
        switch (type.toLowerCase()) {
            case 'gemini':
                return new GeminiExecutor(baseDir);
            default:
                console.warn(`Unknown agent type '${type}', falling back to Gemini.`);
                return new GeminiExecutor(baseDir);
        }
    }
}
