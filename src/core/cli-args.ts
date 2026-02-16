export type CliAction = "help" | "version" | "setup" | "config" | "run";

export interface SetupCliOptions {
    mode?: "init" | "apply";
    skipDiagnose: boolean;
    appId?: string;
    appSecret?: string;
    agentType?: string;
    projectPath?: string;
}

export interface ConfigCliOptions {
    mode?: "list" | "remove" | "update";
    targetAppId?: string;
    appSecret?: string;
    agentType?: string;
    projectPath?: string;
}

export interface CliParseResult {
    action: CliAction;
    errors: string[];
    setupOptions: SetupCliOptions;
    configOptions: ConfigCliOptions;
}

export function getCliUsage(): string {
    return `
Usage: agentsocial [command] [options]

Commands:
  setup init                                    Interactive setup
  setup apply --app-id --app-secret [options]   Non-interactive setup
  config list                                   List saved app configs
  config remove <app_id>                        Remove one app config
  config update <app_id> [field options]        Update one app config
  run           Start the agent service

Global Options:
  -h, --help    Show this help message
  -v, --version Show version

Setup apply options:
  --skip-diagnose
  --app-id <id>
  --app-secret <secret>
  --agent-type <gemini cli|codex|claude>
  --project-path <path>

Config update field options:
  --app-secret <secret>
  --agent-type <gemini cli|codex|claude>
  --project-path <path>
`;
}

const SETUP_APPLY_VALUE_FLAGS = new Set(["--app-id", "--app-secret", "--agent-type", "--project-path"]);
const SETUP_APPLY_BOOL_FLAGS = new Set(["--skip-diagnose"]);
const CONFIG_UPDATE_VALUE_FLAGS = new Set(["--app-secret", "--agent-type", "--project-path"]);

export function parseCliArgs(args: string[]): CliParseResult {
    const setupOptions: SetupCliOptions = {
        skipDiagnose: false
    };
    const configOptions: ConfigCliOptions = {};
    const errors: string[] = [];

    if (args.length === 0) {
        return { action: "help", errors, setupOptions, configOptions };
    }
    if (args.includes("--help") || args.includes("-h")) {
        return { action: "help", errors, setupOptions, configOptions };
    }
    if (args.includes("--version") || args.includes("-v")) {
        return { action: "version", errors, setupOptions, configOptions };
    }

    const command = args[0];

    if (command === "run") {
        if (args.length > 1) {
            errors.push(`未知参数: ${args.slice(1).join(" ")}`);
        }
        return { action: "run", errors, setupOptions, configOptions };
    }

    if (command === "config") {
        const sub = args[1];
        if (!sub) {
            errors.push("config 命令缺少子命令: list/remove/update。");
            return { action: "config", errors, setupOptions, configOptions };
        }

        if (sub === "list") {
            configOptions.mode = "list";
            if (args.length > 2) {
                errors.push(`config list 不接受额外参数: ${args.slice(2).join(" ")}`);
            }
            return { action: "config", errors, setupOptions, configOptions };
        }

        if (sub === "remove") {
            configOptions.mode = "remove";
            const appId = args[2];
            if (!appId || appId.startsWith("--")) {
                errors.push("config remove 缺少 <app_id>。");
            } else {
                configOptions.targetAppId = appId;
            }
            if (args.length > 3) {
                errors.push(`config remove 不接受额外参数: ${args.slice(3).join(" ")}`);
            }
            return { action: "config", errors, setupOptions, configOptions };
        }

        if (sub === "update") {
            configOptions.mode = "update";
            const appId = args[2];
            if (!appId || appId.startsWith("--")) {
                errors.push("config update 缺少 <app_id>。");
                return { action: "config", errors, setupOptions, configOptions };
            }
            configOptions.targetAppId = appId;

            let i = 3;
            while (i < args.length) {
                const token = args[i];
                if (!CONFIG_UPDATE_VALUE_FLAGS.has(token)) {
                    errors.push(`未知 config update 参数: ${token}`);
                    i += 1;
                    continue;
                }
                const value = args[i + 1];
                if (!value || value.startsWith("--")) {
                    errors.push(`参数缺少值: ${token}`);
                    i += 1;
                    continue;
                }
                if (token === "--app-secret") configOptions.appSecret = value;
                if (token === "--agent-type") configOptions.agentType = value;
                if (token === "--project-path") configOptions.projectPath = value;
                i += 2;
            }

            const hasUpdateFields = Boolean(configOptions.appSecret || configOptions.agentType || configOptions.projectPath);
            if (!hasUpdateFields) {
                errors.push("config --update 至少需要一个更新字段: --app-secret/--agent-type/--project-path。");
            }
            return { action: "config", errors, setupOptions, configOptions };
        }

        errors.push(`未知 config 子命令: ${sub}`);
        return { action: "config", errors, setupOptions, configOptions };
    }

    if (command !== "setup") {
        errors.push(`未知命令: ${command}`);
        return { action: "help", errors, setupOptions, configOptions };
    }

    const sub = args[1];
    if (!sub) {
        errors.push("setup 命令缺少子命令: init/apply。");
        return { action: "setup", errors, setupOptions, configOptions };
    }

    if (sub === "init") {
        setupOptions.mode = "init";
        if (args.length > 2) {
            errors.push(`setup init 不接受额外参数: ${args.slice(2).join(" ")}`);
        }
        return { action: "setup", errors, setupOptions, configOptions };
    }

    if (sub === "apply") {
        setupOptions.mode = "apply";
        let i = 2;
        while (i < args.length) {
            const token = args[i];
            if (SETUP_APPLY_BOOL_FLAGS.has(token)) {
                if (token === "--skip-diagnose") setupOptions.skipDiagnose = true;
                i += 1;
                continue;
            }
            if (SETUP_APPLY_VALUE_FLAGS.has(token)) {
                const value = args[i + 1];
                if (!value || value.startsWith("--")) {
                    errors.push(`参数缺少值: ${token}`);
                    i += 1;
                    continue;
                }
                if (token === "--app-id") setupOptions.appId = value;
                if (token === "--app-secret") setupOptions.appSecret = value;
                if (token === "--agent-type") setupOptions.agentType = value;
                if (token === "--project-path") setupOptions.projectPath = value;
                i += 2;
                continue;
            }
            errors.push(`未知 setup apply 参数: ${token}`);
            i += 1;
        }

        if (!setupOptions.appId) errors.push("setup apply 缺少必填参数: --app-id");
        if (!setupOptions.appSecret) errors.push("setup apply 缺少必填参数: --app-secret");
        return { action: "setup", errors, setupOptions, configOptions };
    }

    errors.push(`未知 setup 子命令: ${sub}`);
    return { action: "setup", errors, setupOptions, configOptions };
}
