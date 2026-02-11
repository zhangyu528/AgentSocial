import { parseFeishuCommand } from '../platforms/feishu-utils';
import { GeminiExecutor } from '../core/executor';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

describe('Run 功能 - 指令分拣与 Session 隔离 (Run Functional Tests)', () => {

    describe('parseFeishuCommand', () => {
        it('应当正确剔除机器人自身的 @ 提及并修整内容', () => {
            const rawContent = '  @_user_1  帮我分析这个项目   ';
            const mentions = [{ id: 'bot_id', key: '@_user_1' }];
            const botId = 'bot_id';

            const result = parseFeishuCommand(rawContent, mentions, botId);
            expect(result).toBe('帮我分析这个项目');
        });

        it('处理多行消息时应当保留内部换行但修整两端', () => {
            const rawContent = '@bot \n 第一行 \n 第二行 \n';
            const mentions = [{ id: 'bot', key: '@bot' }];

            const result = parseFeishuCommand(rawContent, mentions, 'bot');
            expect(result).toBe('第一行 \n 第二行');
        });

        it('如果没有被提及，应当返回原始内容（已修整）', () => {
            const result = parseFeishuCommand('  hello world  ', [], 'bot');
            expect(result).toBe('hello world');
        });
    });

    describe('Session 隔离 (Session Isolation)', () => {
        const executor = new GeminiExecutor(process.cwd());

        it('对于不同的 chatId，生成的 Workspace 路径必须是隔离且 MD5 加密的', () => {
            const appId = 'app1';
            const chatId1 = 'chat_A';
            const chatId2 = 'chat_B';

            // @ts-ignore - accessing protected method for testing
            const path1 = executor.getWorkspacePath(appId, chatId1);
            // @ts-ignore
            const path2 = executor.getWorkspacePath(appId, chatId2);

            const hash1 = crypto.createHash('md5').update(chatId1).digest('hex');
            const hash2 = crypto.createHash('md5').update(chatId2).digest('hex');

            expect(path1).toContain(hash1);
            expect(path2).toContain(hash2);
            expect(path1).not.toBe(path2);
        });

        it('Workspace 路径应当位于用户目录的 .agentsocial 子目录下', () => {
            const appId = 'app1';
            const chatId = 'chat_A';
            // @ts-ignore
            const workspace = executor.getWorkspacePath(appId, chatId);

            const expectedBase = path.join(os.homedir(), '.agentsocial', 'sessions');
            expect(workspace).toContain(expectedBase);
        });
        describe('GeminiExecutor - 命令生成 (Command Generation)', () => {
            const executor = new GeminiExecutor(process.cwd());

            // Mock spawn
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

            it('在 plan 模式下，应当包含 --approval-mode plan 标志及计划引导语', async () => {
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
                // 查找包含 "test command" 的参数
                const cmdArg = args.find((a: string) => a.includes('test command'));
                expect(cmdArg).toContain('(Please only output a detailed execution plan text');
            });

            it('在 auto 模式下，应当包含 --yolo 和 --resume latest 标志', async () => {
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
    });
});
