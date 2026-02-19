import { ConfigManager, AppConfig } from '../../src/core/config-manager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ConfigManager - 配置持久化测试', () => {
    let tempDir: string;
    let configManager: ConfigManager;

    beforeEach(() => {
        tempDir = path.join(os.tmpdir(), `agentsocial-test-${Date.now()}`);
        configManager = new ConfigManager(tempDir);
    });

    afterEach(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('如果配置文件不存在，应当返回空数组', () => {
        const settings = configManager.getSettings();
        expect(settings).toEqual([]);
    });

    it('能够正确保存并读取配置', () => {
        const mockConfig: AppConfig = {
            platform: 'feishu',
            app_id: 'test_app',
            app_secret: 'test_secret',
            agent_type: 'gemini cli',
            project_path: '/path/to/project'
        };

        configManager.saveSettings([mockConfig]);

        const settings = configManager.getSettings();
        expect(settings).toHaveLength(1);
        expect(settings[0]).toEqual(mockConfig);
        expect(fs.existsSync(path.join(tempDir, 'settings.json'))).toBe(true);
    });

    it('addApp 应当能追加配置', () => {
        const config1: AppConfig = { platform: 'feishu', app_id: 'app1', app_secret: 's1', agent_type: 'gemini', project_path: 'p1' };
        const config2: AppConfig = { platform: 'feishu', app_id: 'app2', app_secret: 's2', agent_type: 'gemini', project_path: 'p2' };

        configManager.addApp(config1);
        configManager.addApp(config2);

        const settings = configManager.getSettings();
        expect(settings).toHaveLength(2);
        expect(settings[0].app_id).toBe('app1');
        expect(settings[1].app_id).toBe('app2');
    });

    it('应当能处理旧版的非数组格式配置', () => {
        const oldConfig = {
            platform: 'feishu',
            app_id: 'old_app',
            app_secret: 'old_secret',
            agent_type: 'gemini',
            project_path: '/old'
        };

        configManager.ensureConfigDir();
        fs.writeFileSync(path.join(tempDir, 'settings.json'), JSON.stringify(oldConfig));

        const settings = configManager.getSettings();
        expect(Array.isArray(settings)).toBe(true);
        expect(settings[0].app_id).toBe('old_app');
    });

    it('配置文件损坏（非法 JSON）时应安全返回空数组', () => {
        configManager.ensureConfigDir();
        fs.writeFileSync(path.join(tempDir, 'settings.json'), '{invalid-json');

        const settings = configManager.getSettings();
        expect(settings).toEqual([]);
    });

    it('removeApp 应当删除指定 app_id 的配置', () => {
        const config1: AppConfig = { platform: 'feishu', app_id: 'app1', app_secret: 's1', agent_type: 'gemini', project_path: 'p1' };
        const config2: AppConfig = { platform: 'feishu', app_id: 'app2', app_secret: 's2', agent_type: 'codex', project_path: 'p2' };
        configManager.saveSettings([config1, config2]);

        const removed = configManager.removeApp('app1');
        const settings = configManager.getSettings();

        expect(removed).toBe(true);
        expect(settings).toHaveLength(1);
        expect(settings[0].app_id).toBe('app2');
    });

    it('updateApp 应当更新指定 app_id 的字段且不新增记录', () => {
        const config1: AppConfig = { platform: 'feishu', app_id: 'app1', app_secret: 's1', agent_type: 'gemini', project_path: 'p1' };
        configManager.saveSettings([config1]);

        const updated = configManager.updateApp('app1', {
            agent_type: 'codex',
            project_path: 'p-new'
        });
        const settings = configManager.getSettings();

        expect(updated).toBe(true);
        expect(settings).toHaveLength(1);
        expect(settings[0].app_id).toBe('app1');
        expect(settings[0].agent_type).toBe('codex');
        expect(settings[0].project_path).toBe('p-new');
    });
});
