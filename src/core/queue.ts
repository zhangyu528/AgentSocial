import { IAgentExecutor } from './executor';

interface Task {
    appId: string;
    chatId: string;
    command: string;
    projectRoot: string;
    sandbox?: boolean;
    onStdout?: (data: string) => void;
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

    /**
     * 将任务加入队列
     */
    async enqueue(appId: string, chatId: string, command: string, projectRoot: string, sandbox?: boolean, onStdout?: (data: string) => void): Promise<any> {
        return new Promise((resolve, reject) => {
            const task: Task = { appId, chatId, command, projectRoot, sandbox, onStdout, resolve, reject };
            const key = this.getQueueKey(appId, chatId);
            
            if (!this.queues.has(key)) {
                this.queues.set(key, []);
            }
            
            this.queues.get(key)!.push(task);
            this.processNext(key);
        });
    }

    /**
     * 处理特定会话的下一个任务
     */
    private async processNext(key: string) {
        if (this.processing.has(key)) return;

        const queue = this.queues.get(key);
        if (!queue || queue.length === 0) return;

        const task = queue.shift()!;
        this.processing.add(key);

        try {
            console.log(`[Queue] Processing task for ${key}. Pending: ${queue.length}`);
            const result = await this.executor.run({
                appId: task.appId,
                chatId: task.chatId,
                command: task.command,
                projectRoot: task.projectRoot,
                sandbox: task.sandbox,
                onStdout: (data) => {
                    process.stdout.write(data);
                    if (task.onStdout) task.onStdout(data);
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
