import * as fs from 'fs';
import * as path from 'path';
import { FeishuBot } from '../../src/platforms/feishu-bot';
import { FeishuAPI } from '../../src/services/feishu-api';
import { IAgentExecutor, ExecuteOptions, ExecutionResult } from '../../src/core/executor';

let handlers: Record<string, any> = {};

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
            handlers = map;
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
        return { code: 0, stdout: 'ok', stderr: '' };
    }
    respond(): void { }
    dispose(): void { }
}

function loadPayload(fileName: string): any {
    const p = path.join(__dirname, 'payloads', fileName);
    return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function hasPath(obj: any, dottedPath: string): boolean {
    return dottedPath.split('.').every((k) => {
        if (obj == null || !(k in obj)) return false;
        obj = obj[k];
        return true;
    });
}

describe('Feishu event contracts', () => {
    const config = {
        platform: 'feishu',
        app_id: 'cli_contract_app',
        app_secret: 'contract_secret',
        agent_type: 'gemini',
        project_path: process.cwd()
    };

    beforeEach(() => {
        handlers = {};
        jest.restoreAllMocks();

        jest.spyOn(FeishuAPI.prototype, 'diagnose').mockResolvedValue([
            { name: '[BOT_CAPABILITY]', status: true },
            { name: '[SCOPE_READ_MESSAGE]', status: true },
            { name: '[SCOPE_READ_CHAT]', status: true },
            { name: '[SCOPE_APP_INFO]', status: true }
        ] as any);
        jest.spyOn(FeishuAPI.prototype, 'getBotInfo').mockResolvedValue({ open_id: 'ou_bot_001', app_name: 'bot' } as any);
        jest.spyOn(FeishuAPI.prototype, 'getVisibleUsers').mockResolvedValue(['ALL_MEMBERS']);
        jest.spyOn(FeishuAPI.prototype, 'getJoinedChats').mockResolvedValue({ data: { items: [], page_token: '' } } as any);
        jest.spyOn(FeishuAPI.prototype, 'sendCard').mockResolvedValue({} as any);
        jest.spyOn(FeishuAPI.prototype, 'updateCard').mockResolvedValue({} as any);
        jest.spyOn(FeishuAPI.prototype, 'sendMessage').mockResolvedValue({} as any);
    });

    it('im.message.receive_v1 payload should satisfy required contract fields', () => {
        const payload = loadPayload('im.message.receive_v1.json');
        const required = [
            'message.message_id',
            'message.message_type',
            'message.chat_id',
            'message.chat_type',
            'message.content',
            'sender.sender_id.open_id'
        ];
        required.forEach((p) => expect(hasPath(payload, p)).toBe(true));
        expect(payload.message.message_type).toBe('text');
    });

    it('card.action.trigger payload should satisfy required contract fields', () => {
        const payload = loadPayload('card.action.trigger.execute_plan.json');
        const required = [
            'action.value.action_id',
            'action.value.chat_id',
            'action.value.original_cmd',
            'context.open_message_id'
        ];
        required.forEach((p) => expect(hasPath(payload, p)).toBe(true));
        expect(payload.action.value.action_id).toBe('execute_plan');
    });

    it('should handle im.message.receive_v1 payload contract without runtime errors', async () => {
        const bot = new FeishuBot(config, new FakeExecutor(), process.cwd());
        await bot.start();

        const onMessage = handlers['im.message.receive_v1'];
        expect(typeof onMessage).toBe('function');

        const handleIncomingSpy = jest
            .spyOn(bot as any, 'handleIncomingCommand')
            .mockResolvedValue(undefined);

        await expect(onMessage(loadPayload('im.message.receive_v1.json'))).resolves.toBeUndefined();
        expect(handleIncomingSpy).toHaveBeenCalledWith(
            'oc_contract_chat_001',
            '帮我检查这个项目',
            'om_contract_msg_001'
        );
    });

    it('should handle duplicated card.action.trigger payload idempotently', async () => {
        const bot = new FeishuBot(config, new FakeExecutor(), process.cwd());
        await bot.start();

        const onCardAction = handlers['card.action.trigger'];
        expect(typeof onCardAction).toBe('function');

        const executeSpy = jest.spyOn(bot as any, 'executePlan').mockResolvedValue(undefined);
        const payload = loadPayload('card.action.trigger.execute_plan.json');

        await onCardAction(payload);
        await onCardAction(payload);

        expect(executeSpy).toHaveBeenCalledTimes(1);
    });
});
