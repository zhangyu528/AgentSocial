import { GeminiExecutor } from '../../src/core/executor';

describe('Run mode command generation (Integration)', () => {
    const executor = new GeminiExecutor(process.cwd());

    const mockSpawn = jest.spyOn(require('child_process'), 'spawn').mockImplementation(() => {
        const mockChild: any = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn((event, cb) => {
                if (event === 'close') cb(0);
            }),
            stdin: { write: jest.fn() }
        };
        return mockChild;
    });

    beforeEach(() => {
        mockSpawn.mockClear();
    });

    afterAll(() => {
        mockSpawn.mockRestore();
    });

    it('should include --approval-mode plan and planning prompt in plan mode', async () => {
        await executor.run({
            appId: 'test_app',
            chatId: 'test_chat',
            command: 'test command',
            projectRoot: process.cwd(),
            runMode: 'plan',
            silent: true
        });

        const call = mockSpawn.mock.calls[0];
        const args = call[1] as string[];

        expect(args).toContain('--approval-mode');
        expect(args).toContain('plan');
        const cmdArg = args.find((a: string) => a.includes('test command'));
        expect(cmdArg).toContain('(Please only output a detailed execution plan text');
    });

    it('should include --yolo and --resume latest in auto mode', async () => {
        await executor.run({
            appId: 'test_app',
            chatId: 'test_chat',
            command: 'test command',
            projectRoot: process.cwd(),
            runMode: 'auto',
            silent: true
        });

        const call = mockSpawn.mock.calls[0];
        const args = call[1] as string[];

        expect(args).toContain('--yolo');
        expect(args).toContain('--resume');
        expect(args).toContain('latest');
    });
});
