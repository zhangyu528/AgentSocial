import { FeishuAPI } from '../../src/services/feishu-api';
import nock from 'nock';

describe('FeishuAPI - 诊断功能集成测试 (Integration Tests)', () => {
    const appId = 'cli_test_app';
    const appSecret = 'test_secret';
    let feishuApi: FeishuAPI;

    beforeEach(() => {
        feishuApi = new FeishuAPI(appId, appSecret);
        // 清理所有 nock 拦截
        nock.cleanAll();
    });

    it('如果所有权限都开启，诊断结果应当全部通过', async () => {
        // Mock Token
        nock('https://open.feishu.cn')
            .post('/open-apis/auth/v3/app_access_token/internal')
            .reply(200, { code: 0, app_access_token: 'valid_token', tenant_access_token: 'valid_token', expire: 3600 });

        // Mock Bot Info
        nock('https://open.feishu.cn')
            .get('/open-apis/bot/v3/info')
            .reply(200, { code: 0, bot: { activate_status: 1 } });

        // Mock Message List (for im:message:readonly)
        nock('https://open.feishu.cn')
            .get('/open-apis/im/v1/messages')
            .query(true)
            .reply(200, { code: 0, data: { items: [] } });

        // Mock Chat List (for im:chat:readonly)
        nock('https://open.feishu.cn')
            .get('/open-apis/im/v1/chats')
            .query(true)
            .reply(200, { code: 0, data: { items: [] } });

        // Mock App Info (for admin:app.info:readonly)
        nock('https://open.feishu.cn')
            .get(`/open-apis/application/v6/applications/${appId}`)
            .query(true)
            .reply(200, { code: 0, data: { app_name: 'Test App' } });

        const report = await feishuApi.diagnose();

        expect(report.every(item => item.status)).toBe(true);
        expect(report).toHaveLength(4);
    });

    it('如果机器人能力未开启，应当在第一步就拦截并返回 Hint', async () => {
        nock('https://open.feishu.cn')
            .post('/open-apis/auth/v3/app_access_token/internal')
            .reply(200, { code: 0, app_access_token: 'valid_token', tenant_access_token: 'valid_token' });

        nock('https://open.feishu.cn')
            .get('/open-apis/bot/v3/info')
            .reply(400, { code: 99991663, msg: 'bot is disabled' });

        const report = await feishuApi.diagnose();

        expect(report[0].status).toBe(false);
        expect(report[0].hint).toContain('请确保在飞书后台“应用功能”->“机器人”中已启用机器人');
    });

    it('如果权限（如 im:message:readonly）缺失，应当标记为 Failed 并映射 Hint', async () => {
        nock('https://open.feishu.cn')
            .post('/open-apis/auth/v3/app_access_token/internal')
            .reply(200, { code: 0, app_access_token: 'valid_token', tenant_access_token: 'valid_token' });

        nock('https://open.feishu.cn')
            .get('/open-apis/bot/v3/info')
            .reply(200, { code: 0, bot: {} });

        nock('https://open.feishu.cn')
            .get('/open-apis/im/v1/messages')
            .query(true)
            .reply(403, { code: 99991668, msg: 'No permission' });

        // Mock rest as success for this test
        nock('https://open.feishu.cn').get(/.*/).query(true).reply(200, { code: 0, data: {} });

        const report = await feishuApi.diagnose();

        const msgReport = report.find(r => r.name.includes('[SCOPE_READ_MESSAGE]'));
        expect(msgReport).toBeDefined();
        expect(msgReport?.status).toBe(false);
        expect(msgReport?.hint).toContain('请在“权限管理”开启并在“版本发布”中生效');
    });
});
