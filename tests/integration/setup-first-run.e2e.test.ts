import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

describe('Setup First Run E2E (A1.1a~A1.1d)', () => {
    const repoRoot = path.resolve(__dirname, '..', '..');
    let tempRoot: string;
    let testProjectPath: string;
    let configPath: string;

    beforeEach(() => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentsocial-e2e-'));
        testProjectPath = path.join(tempRoot, 'project');
        configPath = path.join(tempRoot, '.agentsocial');
        fs.mkdirSync(testProjectPath, { recursive: true });
    });

    afterEach(() => {
        if (fs.existsSync(tempRoot)) {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    it('A1.1a/A1.1b/A1.1c/A1.1d: 首次 setup 应成功退出、输出成功信息、无错误输出且在时限内完成', () => {
        const startedAt = Date.now();
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
                'cli_app_001',
                '--app-secret',
                'secretValue123',
                '--agent-type',
                'gemini cli',
                '--project-path',
                testProjectPath
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
        const durationMs = Date.now() - startedAt;

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Configuration Complete');
        expect(result.stdout).toContain('saved to ~/.agentsocial/settings.json');
        expect(result.stderr.trim()).toBe('');
        expect(durationMs).toBeLessThan(15000);

        const settingsPath = path.join(configPath, 'settings.json');
        expect(fs.existsSync(settingsPath)).toBe(true);
    });
});
