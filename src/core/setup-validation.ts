export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

const APP_ID_PATTERN = /^[a-zA-Z0-9_-]{3,128}$/;
const APP_SECRET_PATTERN = /^[^\s]{6,256}$/;

export function validateFeishuCredentials(appId: string, appSecret: string): ValidationResult {
    const errors: string[] = [];
    const normalizedAppId = appId.trim();
    const normalizedAppSecret = appSecret.trim();

    if (!normalizedAppId) {
        errors.push('App ID 不能为空。');
    } else if (!APP_ID_PATTERN.test(normalizedAppId)) {
        errors.push('App ID 格式非法：仅允许字母、数字、下划线、中划线，长度 3-128。');
    }

    if (!normalizedAppSecret) {
        errors.push('App Secret 不能为空。');
    } else if (!APP_SECRET_PATTERN.test(normalizedAppSecret)) {
        errors.push('App Secret 格式非法：不能包含空白字符，长度 6-256。');
    }

    return { valid: errors.length === 0, errors };
}
