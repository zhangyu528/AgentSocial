import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";

describe("Config command E2E", () => {
    const repoRoot = path.resolve(__dirname, "..", "..", "..");
    let tempRoot: string;
    let configPath: string;

    beforeEach(() => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentsocial-config-e2e-"));
        configPath = path.join(tempRoot, ".agentsocial");
        fs.mkdirSync(configPath, { recursive: true });
        const settingsPath = path.join(configPath, "settings.json");
        fs.writeFileSync(settingsPath, JSON.stringify([{
            platform: "feishu",
            app_id: "app1",
            app_secret: "secret1",
            agent_type: "gemini cli",
            project_path: path.join(tempRoot, "project")
        }], null, 2));
    });

    afterEach(() => {
        if (fs.existsSync(tempRoot)) {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    function runCli(args: string[]) {
        return spawnSync(
            process.execPath,
            ["-r", "ts-node/register", "src/main.ts", ...args],
            {
                cwd: repoRoot,
                encoding: "utf8",
                env: {
                    ...process.env,
                    AGENTSOCIAL_HOME: configPath
                }
            }
        );
    }

    it("config list should print saved apps", () => {
        const result = runCli(["config", "list"]);
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("app_id=app1");
    });

    it("config update should update app config", () => {
        const result = runCli(["config", "update", "app1", "--agent-type", "codex"]);
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("updated app config");

        const settings = JSON.parse(fs.readFileSync(path.join(configPath, "settings.json"), "utf8"));
        expect(settings[0].agent_type).toBe("codex");
    });

    it("config remove should remove app config", () => {
        const result = runCli(["config", "remove", "app1"]);
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("removed app config");

        const settings = JSON.parse(fs.readFileSync(path.join(configPath, "settings.json"), "utf8"));
        expect(settings).toHaveLength(0);
    });
});
