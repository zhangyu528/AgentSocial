import { validateFeishuCredentials } from '../../src/core/setup-validation';

describe('Setup Validation - 凭证合法性校验', () => {
    it('合法凭证应当通过校验', () => {
        const result = validateFeishuCredentials('cli_app_001', 'secretValue123');
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('非法 app_id 应当被拒绝', () => {
        const result = validateFeishuCredentials('bad id', 'secretValue123');
        expect(result.valid).toBe(false);
        expect(result.errors.join('\n')).toContain('App ID 格式非法');
    });

    it('非法 app_secret 应当被拒绝', () => {
        const result = validateFeishuCredentials('cli_app_001', 'bad secret');
        expect(result.valid).toBe(false);
        expect(result.errors.join('\n')).toContain('App Secret 格式非法');
    });

    it('空值应当给出明确错误', () => {
        const result = validateFeishuCredentials('   ', '');
        expect(result.valid).toBe(false);
        expect(result.errors.join('\n')).toContain('App ID 不能为空');
        expect(result.errors.join('\n')).toContain('App Secret 不能为空');
    });
});
