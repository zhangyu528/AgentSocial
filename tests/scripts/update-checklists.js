const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");

const CHECKLISTS = {
  unit: path.resolve(ROOT, "tests", "unit", "UNIT_CHECKLIST.md"),
  integration: path.resolve(ROOT, "tests", "integration", "INTEGRATION_CHECKLIST.md"),
  e2eLocal: path.resolve(ROOT, "tests", "e2e", "local", "E2E_LOCAL_CHECKLIST.md"),
  smoke: path.resolve(ROOT, "tests", "smoke", "SMOKE_CHECKLIST.md"),
  master: path.resolve(ROOT, "tests", "MASTER_RELEASE_CHECKLIST.md"),
};

function runNpmScript(scriptName) {
  const result = spawnSync("npm", ["run", scriptName], {
    stdio: "inherit",
    shell: true,
    cwd: ROOT,
  });
  return result.status === 0;
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeUtf8(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
}

function setCheckedState(line, checked) {
  return line.replace(/^- \[[ x]\]/, `- [${checked ? "x" : " "}]`);
}

function updateAutomatedItems(content, passed) {
  const lines = content.split(/\r?\n/);
  const itemLineRegex = /^- \[[ x]\] ([A-Z]+[0-9]+(?:\.\d+)*)(?:[.)])?\s.*/;

  for (let i = 0; i < lines.length; i++) {
    const itemMatch = lines[i].match(itemLineRegex);
    if (!itemMatch) continue;

    let j = i + 1;
    const metadataLines = [];
    while (
      j < lines.length &&
      !/^##\s/.test(lines[j]) &&
      !/^- \[[ x]\]\s/.test(lines[j])
    ) {
      metadataLines.push(lines[j]);
      j += 1;
    }

    const metadata = metadataLines.join(" ");
    const hasAutomatedTag =
      /Verification:\s*automated/i.test(metadata) ||
      /\u81EA\u52A8\u5316\u6765\u6E90/.test(metadata);
    const hasManualTag =
      /\[MANUAL\]/i.test(lines[i]) ||
      /Verification:\s*manual/i.test(metadata);

    // Auto-update only pure automated items.
    if (hasAutomatedTag && !hasManualTag) {
      lines[i] = setCheckedState(lines[i], passed);
    }
  }

  return lines.join("\n");
}

function updateMasterGates(content, results) {
  const lines = content.split(/\r?\n/);
  const gateStatus = {
    MR1: results.unit,
    MR2: results.integration,
    MR3: results.e2eLocal,
    MR4: results.smoke,
  };

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^- \[[ x]\]\s(MR[1-4])(?:[.)])?\s.*/);
    if (!m) continue;
    const gate = m[1];
    const status = gateStatus[gate];
    if (typeof status === "boolean") {
      lines[i] = setCheckedState(lines[i], status);
    }
  }

  return lines.join("\n");
}

function ensureFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Checklist file not found: ${filePath}`);
  }
}

function main() {
  Object.values(CHECKLISTS).forEach(ensureFileExists);

  const shouldRunSmoke =
    Boolean(process.env.FEISHU_APP_ID?.trim()) &&
    Boolean(process.env.FEISHU_APP_SECRET?.trim());

  const results = {
    unit: null,
    integration: null,
    contract: null,
    e2eLocal: null,
    smoke: null,
  };

  results.unit = runNpmScript("test:unit");
  results.integration = runNpmScript("test:integration");
  results.contract = runNpmScript("test:contract");
  results.e2eLocal = runNpmScript("test:e2e");

  if (shouldRunSmoke) {
    results.smoke = runNpmScript("test:smoke");
  } else {
    console.log(
      "[checklists:update] Skip smoke update. Set FEISHU_APP_ID and FEISHU_APP_SECRET to run smoke."
    );
  }

  let unit = readUtf8(CHECKLISTS.unit);
  unit = updateAutomatedItems(unit, results.unit);
  writeUtf8(CHECKLISTS.unit, unit);

  let integration = readUtf8(CHECKLISTS.integration);
  integration = updateAutomatedItems(integration, results.integration);
  writeUtf8(CHECKLISTS.integration, integration);

  let e2eLocal = readUtf8(CHECKLISTS.e2eLocal);
  e2eLocal = updateAutomatedItems(e2eLocal, results.e2eLocal);
  writeUtf8(CHECKLISTS.e2eLocal, e2eLocal);

  if (typeof results.smoke === "boolean") {
    let smoke = readUtf8(CHECKLISTS.smoke);
    smoke = updateAutomatedItems(smoke, results.smoke);
    writeUtf8(CHECKLISTS.smoke, smoke);
  }

  let master = readUtf8(CHECKLISTS.master);
  master = updateMasterGates(master, results);
  writeUtf8(CHECKLISTS.master, master);

  const failures = Object.entries(results)
    .filter(([, v]) => v === false)
    .map(([k]) => k);

  if (failures.length > 0) {
    console.error(
      `[checklists:update] Updated checklists, but failed suites: ${failures.join(
        ", "
      )}`
    );
    process.exit(1);
  }

  console.log("[checklists:update] Checklists updated successfully.");
}

main();
