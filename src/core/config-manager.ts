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

export type AppConfigUpdate = Partial<Pick<AppConfig, "app_secret" | "agent_type" | "project_path">>;

export class ConfigManager {
    private configDir: string;
    private settingsPath: string;

    constructor(customConfigDir?: string) {
        const envConfigDir = process.env.AGENTSOCIAL_HOME;
        this.configDir = customConfigDir || envConfigDir || path.join(os.homedir(), '.agentsocial');
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
        const index = current.findIndex(item =>
            item.platform === config.platform && item.app_id === config.app_id
        );

        if (index >= 0) {
            current[index] = config;
        } else {
            current.push(config);
        }

        this.saveSettings(current);
    }

    public removeApp(appId: string): boolean {
        const current = this.getSettings();
        const next = current.filter(item => item.app_id !== appId);
        if (next.length === current.length) return false;
        this.saveSettings(next);
        return true;
    }

    public updateApp(appId: string, update: AppConfigUpdate): boolean {
        const current = this.getSettings();
        const index = current.findIndex(item => item.app_id === appId);
        if (index < 0) return false;
        current[index] = {
            ...current[index],
            ...update
        };
        this.saveSettings(current);
        return true;
    }
}
