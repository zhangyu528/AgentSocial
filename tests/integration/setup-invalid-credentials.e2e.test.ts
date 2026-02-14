import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

describe('Setup Invalid Credentials E2E (A3/A1.7)', () => {
    const repoRoot = path.resolve(__dirname, '..', '..');
    let tempRoot: string;
    let configPath: string;

    beforeEach(() => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentsocial-e2e-invalid-'));
        configPath = path.join(tempRoot, '.agentsocial');
    });

    afterEach(() => {
        if (fs.existsSync(tempRoot)) {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    it('非法 app_id/app_secret 应返回非 0 退出码并输出明确错误', () => {
        const result = spawnSync(
            process.execPath,
            [
                '-r',
                'ts-node/register',
                'src/main.ts',
                'setup',
                '--non-interactive',
                '--skip-diagnose',
                '--app-id',
                'bad id',
                '--app-secret',
                'bad secret'
            ],
            {
                cwd: repoRoot,
                encoding: 'utf8',
                env: {
                    ...process.env,
                    AGENTSOCIAL_HOME: configPath
                }
            }
        );

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('setup failed');
        expect(result.stderr).toContain('凭证校验失败');
        expect(fs.existsSync(path.join(configPath, 'settings.json'))).toBe(false);
    });
});
