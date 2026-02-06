import { IAgentExecutor } from './executor';

interface Task {
    appId: string;
    chatId: string;
    command: string;
    projectRoot: string;
    sandbox?: boolean;
    runMode?: 'plan' | 'auto';
    onStdout?: (data: string) => void;
    onApprovalRequired?: (prompt: string) => void;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
}

export class TaskQueue {
    private queues: Map<string, Task[]> = new Map();
    private processing: Set<string> = new Set();
    private executor: IAgentExecutor;

    constructor(executor: IAgentExecutor) {
        this.executor = executor;
    }

    private getQueueKey(appId: string, chatId: string): string {
        return `${appId}:${chatId}`;
    }

    async enqueue(appId: string, chatId: string, command: string, projectRoot: string, sandbox?: boolean, runMode: 'plan' | 'auto' = 'auto', onStdout?: (data: string) => void, onApprovalRequired?: (prompt: string) => void): Promise<any> {
        return new Promise((resolve, reject) => {
            const task: Task = { appId, chatId, command, projectRoot, sandbox, runMode, onStdout, onApprovalRequired, resolve, reject };
            const key = this.getQueueKey(appId, chatId);
            if (!this.queues.has(key)) this.queues.set(key, []);
            this.queues.get(key)!.push(task);
            this.processNext(key);
        });
    }

    private async processNext(key: string) {
        if (this.processing.has(key)) return;
        const queue = this.queues.get(key);
        if (!queue || queue.length === 0) return;

        const task = queue.shift()!;
        this.processing.add(key);

        try {
            const result = await this.executor.run({
                appId: task.appId,
                chatId: task.chatId,
                command: task.command,
                projectRoot: task.projectRoot,
                sandbox: task.sandbox,
                runMode: task.runMode,
                onStdout: (data) => {
                    if (task.onStdout) task.onStdout(data);
                },
                onApprovalRequired: (prompt) => {
                    if (task.onApprovalRequired) task.onApprovalRequired(prompt);
                }
            });
            task.resolve(result);
        } catch (error) {
            task.reject(error);
        } finally {
            this.processing.delete(key);
            this.processNext(key);
        }
    }
}