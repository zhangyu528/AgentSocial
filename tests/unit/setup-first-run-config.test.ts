import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager, AppConfig } from '../../src/core/config-manager';

describe('Setup First Run - 配置初始化检查 (A1.x)', () => {
    let tempHomeRoot: string;
    let configDir: string;
    let manager: ConfigManager;

    beforeEach(() => {
        tempHomeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentsocial-a1-'));
        configDir = path.join(tempHomeRoot, '.agentsocial');
        manager = new ConfigManager(configDir);
    });

    afterEach(() => {
        if (fs.existsSync(tempHomeRoot)) {
            fs.rmSync(tempHomeRoot, { recursive: true, force: true });
        }
    });

    function makeConfig(): AppConfig {
        return {
            platform: 'feishu',
            app_id: 'cli_app_001',
            app_secret: 'secretValue123',
            agent_type: 'gemini cli',
            project_path: tempHomeRoot
        };
    }

    it('A1.2/A1.3: 首次保存应创建 .agentsocial 与 settings.json 且 JSON 合法', () => {
        manager.addApp(makeConfig());

        const settingsPath = path.join(configDir, 'settings.json');
        expect(fs.existsSync(configDir)).toBe(true);
        expect(fs.existsSync(settingsPath)).toBe(true);

        const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed).toHaveLength(1);
    });

    it('A1.4/A1.5: 必填字段完整且写入后可读取', () => {
        const config = makeConfig();
        manager.addApp(config);

        const settings = manager.getSettings();
        expect(settings).toHaveLength(1);
        expect(settings[0]).toMatchObject({
            platform: config.platform,
            app_id: config.app_id,
            app_secret: config.app_secret,
            agent_type: config.agent_type,
            project_path: config.project_path
        });
    });

    it('A1.8: 仅写入预期目录，不污染其他路径', () => {
        manager.addApp(makeConfig());

        const rootEntries = fs.readdirSync(tempHomeRoot);
        expect(rootEntries).toEqual(['.agentsocial']);

        const configEntries = fs.readdirSync(configDir);
        expect(configEntries).toEqual(['settings.json']);
    });

    it('A5: setup 阶段应创建预期目录结构（.agentsocial/settings.json）', () => {
        manager.addApp(makeConfig());

        expect(fs.existsSync(configDir)).toBe(true);
        expect(fs.statSync(configDir).isDirectory()).toBe(true);

        const settingsPath = path.join(configDir, 'settings.json');
        expect(fs.existsSync(settingsPath)).toBe(true);
        expect(fs.statSync(settingsPath).isFile()).toBe(true);

        const entries = fs.readdirSync(configDir);
        expect(entries).toEqual(['settings.json']);
    });
});
