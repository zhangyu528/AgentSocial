import { readProjectVersion, resolvePackageJsonPath } from "../../src/core/version";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("Version lookup", () => {
    let tempRoot: string;

    beforeEach(() => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentsocial-version-"));
    });

    afterEach(() => {
        if (fs.existsSync(tempRoot)) {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    });

    it("should resolve package.json from cwd first", () => {
        const pkgPath = path.join(tempRoot, "package.json");
        fs.writeFileSync(pkgPath, JSON.stringify({ version: "1.2.3" }));

        const resolved = resolvePackageJsonPath(tempRoot, path.join(tempRoot, "dist", "src"));
        expect(resolved).toBe(pkgPath);
        expect(readProjectVersion(tempRoot, path.join(tempRoot, "dist", "src"))).toBe("1.2.3");
    });

    it("should fallback to ../package.json for ts-node style currentDir", () => {
        const projectRoot = path.join(tempRoot, "AgentSocial");
        const srcDir = path.join(projectRoot, "src");
        fs.mkdirSync(srcDir, { recursive: true });
        fs.writeFileSync(path.join(projectRoot, "package.json"), JSON.stringify({ version: "2.0.0" }));

        const resolved = resolvePackageJsonPath(path.join(tempRoot, "other"), srcDir);
        expect(resolved).toBe(path.join(projectRoot, "package.json"));
    });
});

