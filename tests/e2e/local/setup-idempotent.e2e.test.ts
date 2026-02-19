import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

describe('Setup Idempotent E2E (A6)', () => {
    const repoRoot = path.resolve(__dirname, '..', '..', '..');
    let tempRoot: string;
    let testProjectPath: string;
    let configPath: string;

    beforeEach(() => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentsocial-e2e-a6-'));
        testProjectPath = path.join(tempRoot, 'project');
        configPath = path.join(tempRoot, '.agentsocial');
        fs.mkdirSync(testProjectPath, { recursive: true });
    });

    afterEach(() => {
        if (fs.existsSync(tempRoot)) {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    function runSetup(projectPath = testProjectPath, agentType = 'gemini cli') {
        return spawnSync(
            process.execPath,
            [
                '-r',
                'ts-node/register',
                'src/main.ts',
                'setup',
                'apply',
                '--skip-diagnose',
                '--app-id',
                'cli_app_001',
                '--app-secret',
                'secretValue123',
                '--agent-type',
                agentType,
                '--project-path',
                projectPath
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
    }

    it('重复执行 setup 不应产生重复配置', () => {
        const first = runSetup();
        const second = runSetup();

        expect(first.status).toBe(0);
        expect(second.status).toBe(0);

        const settingsPath = path.join(configPath, 'settings.json');
        expect(fs.existsSync(settingsPath)).toBe(true);

        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        expect(Array.isArray(settings)).toBe(true);
        expect(settings).toHaveLength(1);
        expect(settings[0].app_id).toBe('cli_app_001');
        expect(settings[0].project_path).toBe(testProjectPath);
    });

    it('重复执行 setup 时应更新同一 app 配置，而不是新增重复记录', () => {
        const firstProject = path.join(tempRoot, 'project-a');
        const secondProject = path.join(tempRoot, 'project-b');
        fs.mkdirSync(firstProject, { recursive: true });
        fs.mkdirSync(secondProject, { recursive: true });

        const first = runSetup(firstProject, 'gemini cli');
        const second = runSetup(secondProject, 'codex');

        expect(first.status).toBe(0);
        expect(second.status).toBe(0);

        const settingsPath = path.join(configPath, 'settings.json');
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        expect(settings).toHaveLength(1);
        expect(settings[0].app_id).toBe('cli_app_001');
        expect(settings[0].project_path).toBe(secondProject);
        expect(settings[0].agent_type).toBe('codex');
    });
});

