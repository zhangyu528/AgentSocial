import { TaskQueue } from '../../src/core/queue';
import { IAgentExecutor, ExecuteOptions, ExecutionResult } from '../../src/core/executor';

class FakeExecutor implements IAgentExecutor {
    public starts: Array<{ key: string; at: number }> = [];
    public ends: Array<{ key: string; at: number }> = [];
    public concurrent = 0;
    public maxConcurrent = 0;
    private readonly delayMs: number;

    constructor(delayMs: number = 40) {
        this.delayMs = delayMs;
    }

    async run(options: ExecuteOptions): Promise<ExecutionResult> {
        const key = `${options.appId}:${options.chatId}`;
        this.starts.push({ key, at: Date.now() });
        this.concurrent += 1;
        this.maxConcurrent = Math.max(this.maxConcurrent, this.concurrent);

        await new Promise(resolve => setTimeout(resolve, this.delayMs));

        this.concurrent -= 1;
        this.ends.push({ key, at: Date.now() });
        return { code: 0, stdout: 'ok', stderr: '' };
    }

    respond(): void { }
    dispose(): void { }
}

describe('TaskQueue integration behavior', () => {
    it('should execute tasks serially for the same appId+chatId', async () => {
        const executor = new FakeExecutor(50);
        const queue = new TaskQueue(executor);

        const p1 = queue.enqueue('app1', 'chatA', 'cmd1', process.cwd(), 'auto');
        const p2 = queue.enqueue('app1', 'chatA', 'cmd2', process.cwd(), 'auto');
        await Promise.all([p1, p2]);

        expect(executor.starts).toHaveLength(2);
        expect(executor.ends).toHaveLength(2);
        // second task should not start before first one ends.
        expect(executor.starts[1].at).toBeGreaterThanOrEqual(executor.ends[0].at);
        expect(executor.maxConcurrent).toBe(1);
    });

    it('should allow parallel execution across different chatIds', async () => {
        const executor = new FakeExecutor(80);
        const queue = new TaskQueue(executor);

        const p1 = queue.enqueue('app1', 'chatA', 'cmd1', process.cwd(), 'auto');
        const p2 = queue.enqueue('app1', 'chatB', 'cmd2', process.cwd(), 'auto');
        await Promise.all([p1, p2]);

        expect(executor.starts).toHaveLength(2);
        expect(executor.maxConcurrent).toBeGreaterThanOrEqual(2);
    });
});
