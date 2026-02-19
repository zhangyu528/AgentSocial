import * as fs from "fs";
import * as path from "path";

export function resolvePackageJsonPath(cwd: string, currentDir: string): string | null {
    const candidates = [
        path.join(cwd, "package.json"),
        path.resolve(currentDir, "..", "package.json"),
        path.resolve(currentDir, "..", "..", "package.json")
    ];
    return candidates.find(p => fs.existsSync(p)) || null;
}

export function readProjectVersion(cwd: string, currentDir: string): string {
    const packagePath = resolvePackageJsonPath(cwd, currentDir);
    if (!packagePath) {
        throw new Error("Cannot locate package.json for version lookup.");
    }
    const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    if (!packageJson?.version) {
        throw new Error("Missing version field in package.json.");
    }
    return String(packageJson.version);
}

