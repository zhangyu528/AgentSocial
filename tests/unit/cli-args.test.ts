import { parseCliArgs } from "../../src/core/cli-args";

describe("CLI args resolution", () => {
    it("no args should show help", () => {
        const result = parseCliArgs([]);
        expect(result.action).toBe("help");
        expect(result.errors).toHaveLength(0);
    });

    it("-h/--help should show help", () => {
        expect(parseCliArgs(["-h"]).action).toBe("help");
        expect(parseCliArgs(["--help"]).action).toBe("help");
    });

    it("-v/--version should show version", () => {
        expect(parseCliArgs(["-v"]).action).toBe("version");
        expect(parseCliArgs(["--version"]).action).toBe("version");
    });

    it("run should resolve run action", () => {
        expect(parseCliArgs(["run"]).action).toBe("run");
    });

    it("unknown command should return help with error", () => {
        const result = parseCliArgs(["foo"]);
        expect(result.action).toBe("help");
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it("setup init should resolve setup action", () => {
        const result = parseCliArgs(["setup", "init"]);
        expect(result.action).toBe("setup");
        expect(result.setupOptions.mode).toBe("init");
        expect(result.errors).toHaveLength(0);
    });

    it("setup apply should require app-id and app-secret", () => {
        const result = parseCliArgs(["setup", "apply"]);
        expect(result.action).toBe("setup");
        expect(result.setupOptions.mode).toBe("apply");
        expect(result.errors.join(" ")).toContain("--app-id");
        expect(result.errors.join(" ")).toContain("--app-secret");
    });

    it("setup apply should parse options", () => {
        const result = parseCliArgs([
            "setup",
            "apply",
            "--skip-diagnose",
            "--app-id",
            "a1",
            "--app-secret",
            "s1",
            "--agent-type",
            "codex",
            "--project-path",
            "C:\\repo"
        ]);
        expect(result.errors).toHaveLength(0);
        expect(result.setupOptions.mode).toBe("apply");
        expect(result.setupOptions.skipDiagnose).toBe(true);
        expect(result.setupOptions.appId).toBe("a1");
        expect(result.setupOptions.appSecret).toBe("s1");
    });

    it("config list should resolve config action", () => {
        const result = parseCliArgs(["config", "list"]);
        expect(result.action).toBe("config");
        expect(result.configOptions.mode).toBe("list");
        expect(result.errors).toHaveLength(0);
    });

    it("config should require subcommand", () => {
        const result = parseCliArgs(["config"]);
        expect(result.action).toBe("config");
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it("config list should reject extra args", () => {
        const result = parseCliArgs(["config", "list", "extra"]);
        expect(result.action).toBe("config");
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it("config should reject unknown subcommand", () => {
        const result = parseCliArgs(["config", "foo"]);
        expect(result.action).toBe("config");
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it("config remove should require app id", () => {
        const result = parseCliArgs(["config", "remove"]);
        expect(result.action).toBe("config");
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it("config update should require update fields", () => {
        const result = parseCliArgs(["config", "update", "app1"]);
        expect(result.action).toBe("config");
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it("config update should parse update fields", () => {
        const result = parseCliArgs(["config", "update", "app1", "--agent-type", "codex"]);
        expect(result.errors).toHaveLength(0);
        expect(result.configOptions.mode).toBe("update");
        expect(result.configOptions.targetAppId).toBe("app1");
        expect(result.configOptions.agentType).toBe("codex");
    });
});
