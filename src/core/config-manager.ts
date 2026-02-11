import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AppConfig {
    platform: string;
    app_id: string;
    app_secret: string;
    agent_type: string;
    project_path: string;
}

export class ConfigManager {
    private configDir: string;
    private settingsPath: string;

    constructor(customConfigDir?: string) {
        this.configDir = customConfigDir || path.join(os.homedir(), '.agentsocial');
        this.settingsPath = path.join(this.configDir, 'settings.json');
    }

    public ensureConfigDir() {
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
        }
    }

    public getSettings(): AppConfig[] {
        if (!fs.existsSync(this.settingsPath)) {
            return [];
        }
        try {
            const content = fs.readFileSync(this.settingsPath, 'utf8');
            const data = JSON.parse(content);
            return Array.isArray(data) ? data : (data.apps || [data]);
        } catch (e) {
            return [];
        }
    }

    public saveSettings(configs: AppConfig[]) {
        this.ensureConfigDir();
        fs.writeFileSync(this.settingsPath, JSON.stringify(configs, null, 2));
    }

    public addApp(config: AppConfig) {
        const current = this.getSettings();
        current.push(config);
        this.saveSettings(current);
    }
}
