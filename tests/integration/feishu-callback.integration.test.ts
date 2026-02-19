import { FeishuBot } from '../../src/platforms/feishu-bot';
import { FeishuAPI } from '../../src/services/feishu-api';
import { IAgentExecutor, ExecuteOptions, ExecutionResult } from '../../src/core/executor';

let registeredHandlers: Record<string, any> = {};

jest.mock('@larksuiteoapi/node-sdk', () => {
    class Client {
        public im: any;
        public contact: any;
        constructor() {
            this.im = {
                message: { create: jest.fn(), list: jest.fn() },
                chat: { list: jest.fn() }
            };
            this.contact = {
                user: { list: jest.fn(), findByDepartment: jest.fn() }
            };
        }
        request = jest.fn();
    }

    class EventDispatcher {
        register(map: Record<string, any>) {
            registeredHandlers = map;
            return this;
        }
    }

    class WSClient {
        async start() { return; }
    }

    return {
        Client,
        EventDispatcher,
        WSClient,
        LoggerLevel: { error: 0 }
    };
});

class FakeExecutor implements IAgentExecutor {
    async run(_options: ExecuteOptions): Promise<ExecutionResult> {
        return { code: 0, stdout: 'plan ok', stderr: '' };
    }
    respond(): void { }
    dispose(): void { }
}

describe('Feishu card callback integration', () => {
    const config = {
        platform: 'feishu',
        app_id: 'cli_test_app',
        app_secret: 'test_secret',
        agent_type: 'gemini',
        project_path: process.cwd()
    };

    beforeEach(() => {
        registeredHandlers = {};
        jest.restoreAllMocks();

        jest.spyOn(FeishuAPI.prototype, 'diagnose').mockResolvedValue([
            { name: '[BOT_CAPABILITY]', status: true },
            { name: '[SCOPE_READ_MESSAGE]', status: true },
            { name: '[SCOPE_READ_CHAT]', status: true },
            { name: '[SCOPE_APP_INFO]', status: true }
        ] as any);
        jest.spyOn(FeishuAPI.prototype, 'getBotInfo').mockResolvedValue({ open_id: 'bot_open_id', app_name: 'bot' } as any);
        jest.spyOn(FeishuAPI.prototype, 'getVisibleUsers').mockResolvedValue(['ALL_MEMBERS']);
        jest.spyOn(FeishuAPI.prototype, 'getJoinedChats').mockResolvedValue({ data: { items: [], page_token: '' } } as any);
        jest.spyOn(FeishuAPI.prototype, 'sendCard').mockResolvedValue({} as any);
        jest.spyOn(FeishuAPI.prototype, 'updateCard').mockResolvedValue({} as any);
        jest.spyOn(FeishuAPI.prototype, 'sendMessage').mockResolvedValue({} as any);
    });

    it('should handle approve/deny/execute_plan callback branches', async () => {
        const bot = new FeishuBot(config, new FakeExecutor(), process.cwd());
        await bot.start();

        const handler = registeredHandlers['card.action.trigger'];
        expect(typeof handler).toBe('function');

        const approveSpy = jest.spyOn(bot as any, 'approve');
        const denySpy = jest.spyOn(bot as any, 'deny');
        const executeSpy = jest.spyOn(bot as any, 'executePlan').mockResolvedValue(undefined);
        const updateSpy = jest.spyOn((bot as any).api, 'updateCard');

        await handler({
            action: { value: { action_id: 'approve', chat_id: 'chatA', prompt: 'rm -rf /tmp' } },
            context: { open_message_id: 'msg1' }
        });
        await handler({
            action: { value: { action_id: 'deny', chat_id: 'chatA', prompt: 'danger op' } },
            context: { open_message_id: 'msg2' }
        });
        await handler({
            action: { value: { action_id: 'execute_plan', chat_id: 'chatA', original_cmd: 'fix tests' } },
            context: { open_message_id: 'msg3' }
        });

        expect(approveSpy).toHaveBeenCalledWith('chatA');
        expect(denySpy).toHaveBeenCalledWith('chatA');
        expect(executeSpy).toHaveBeenCalledWith('chatA', 'fix tests', 'msg3');
        expect(updateSpy).toHaveBeenCalledTimes(3);
    });

    it('should be idempotent for duplicated card.action.trigger callbacks', async () => {
        const bot = new FeishuBot(config, new FakeExecutor(), process.cwd());
        await bot.start();

        const handler = registeredHandlers['card.action.trigger'];
        const executeSpy = jest.spyOn(bot as any, 'executePlan').mockResolvedValue(undefined);

        const payload = {
            action: { value: { action_id: 'execute_plan', chat_id: 'chatA', original_cmd: 'fix tests' } },
            context: { open_message_id: 'dup_msg' }
        };

        const first = await handler(payload);
        const second = await handler(payload);

        expect(executeSpy).toHaveBeenCalledTimes(1);
        expect(first?.toast?.type).toBe('info');
        expect(second?.toast?.type).toBe('info');
    });
});
