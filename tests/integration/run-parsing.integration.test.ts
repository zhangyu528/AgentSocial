import { parseFeishuCommand } from '../../src/platforms/feishu-utils';
import { GeminiExecutor } from '../../src/core/executor';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

describe('Run parsing and session isolation (Integration)', () => {
    describe('parseFeishuCommand', () => {
        it('should remove bot mention and trim surrounding spaces', () => {
            const rawContent = '  @_user_1  帮我分析这个项目   ';
            const mentions = [{ id: 'bot_id', key: '@_user_1' }];
            const botId = 'bot_id';

            const result = parseFeishuCommand(rawContent, mentions, botId);
            expect(result).toBe('帮我分析这个项目');
        });

        it('should preserve internal newlines while trimming edges', () => {
            const rawContent = '@bot \n 第一行\n 第二行\n';
            const mentions = [{ id: 'bot', key: '@bot' }];

            const result = parseFeishuCommand(rawContent, mentions, 'bot');
            expect(result).toBe('第一行\n 第二行');
        });

        it('should return trimmed original content when bot is not mentioned', () => {
            const result = parseFeishuCommand('  hello world  ', [], 'bot');
            expect(result).toBe('hello world');
        });
    });

    describe('session isolation', () => {
        const executor = new GeminiExecutor(process.cwd());

        it('should generate isolated MD5-based workspace paths for different chatIds', () => {
            const appId = 'app1';
            const chatId1 = 'chat_A';
            const chatId2 = 'chat_B';

            // @ts-ignore test access to protected method
            const path1 = executor.getWorkspacePath(appId, chatId1);
            // @ts-ignore test access to protected method
            const path2 = executor.getWorkspacePath(appId, chatId2);

            const hash1 = crypto.createHash('md5').update(chatId1).digest('hex');
            const hash2 = crypto.createHash('md5').update(chatId2).digest('hex');

            expect(path1).toContain(hash1);
            expect(path2).toContain(hash2);
            expect(path1).not.toBe(path2);
        });

        it('should place workspace under ~/.agentsocial/sessions', () => {
            const appId = 'app1';
            const chatId = 'chat_A';
            // @ts-ignore test access to protected method
            const workspace = executor.getWorkspacePath(appId, chatId);

            const expectedBase = path.join(os.homedir(), '.agentsocial', 'sessions');
            expect(workspace).toContain(expectedBase);
        });
    });
});
