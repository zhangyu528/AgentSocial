import { FeishuAPI } from '../../src/services/feishu-api';

type DiagnoseItem = { name: string; status: boolean; error?: string; hint?: string };

function requireEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing required env: ${name}`);
    }
    return value;
}

function findByKey(report: DiagnoseItem[], key: string): DiagnoseItem | undefined {
    return report.find(item => item.name.includes(`[${key}]`));
}

describe('Feishu Real Smoke E2E', () => {
    jest.setTimeout(120000);

    const appId = requireEnv('FEISHU_APP_ID');
    const appSecret = requireEnv('FEISHU_APP_SECRET');
    const requiredChecks = (process.env.FEISHU_SMOKE_REQUIRED || 'BOT_CAPABILITY,SCOPE_READ_MESSAGE,SCOPE_READ_CHAT,SCOPE_APP_INFO')
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
    const smokeChatId = process.env.FEISHU_SMOKE_CHAT_ID?.trim();
    const api = new FeishuAPI(appId, appSecret);

    it('diagnose should pass required capability/scope checks on real Feishu endpoints', async () => {
        const report = await api.diagnose();

        for (const key of requiredChecks) {
            const item = findByKey(report, key);
            expect(item).toBeDefined();
            expect(item?.status).toBe(true);
        }
    });

    it('should send a real smoke message when FEISHU_SMOKE_CHAT_ID is provided', async () => {
        if (!smokeChatId) {
            expect(true).toBe(true);
            return;
        }

        const content = `[AgentSocial Smoke] ${new Date().toISOString()}`;
        await expect(api.sendMessage(smokeChatId, 'chat_id', content)).resolves.toBeDefined();
    });
});

