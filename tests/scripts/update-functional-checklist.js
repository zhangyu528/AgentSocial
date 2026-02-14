const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const checklistPath = path.resolve(
  __dirname,
  "..",
  "docs",
  "FUNCTIONAL_TEST_CHECKLIST.md"
);

function runNpmScript(scriptName) {
  const result = spawnSync("npm", ["run", scriptName], {
    stdio: "inherit",
    shell: true,
  });
  return result.status === 0;
}

function setCheckedState(line, checked) {
  return line.replace(/^- \[[ x]\]/, `- [${checked ? "x" : " "}]`);
}

function updateAutomatedItems(content, testPassed, coveragePassed) {
  const lines = content.split(/\r?\n/);
  const itemLineRegex = /^- \[[ x]\] ([A-E]\d+(?:\.\d+)*(?:[a-z])?)(?:[.)])?\s.*/;

  for (let i = 0; i < lines.length; i++) {
    const itemMatch = lines[i].match(itemLineRegex);
    if (!itemMatch) continue;

    const itemId = itemMatch[1];
    if (itemId === "E1") {
      lines[i] = setCheckedState(lines[i], testPassed);
      continue;
    }
    if (itemId === "E2") {
      lines[i] = setCheckedState(lines[i], coveragePassed);
      continue;
    }

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
    const hasAutomationTag =
      /验证方式:\s*自动化/.test(metadata) || /自动化来源:/.test(metadata);
    const hasManualDependency =
      /验证方式:\s*人工/.test(metadata) ||
      /自动化\s*\+\s*人工/.test(metadata) ||
      /人工补充确认/.test(metadata);

    if (hasAutomationTag && !hasManualDependency) {
      lines[i] = setCheckedState(lines[i], testPassed);
    }
  }

  return lines.join("\n");
}

function updatePassRate(content) {
  const itemLines = content.match(/^- \[[ x]\] [A-E]\d+(?:\.\d+)*(?:[a-z])?(?:[.)])?\s.*$/gm) || [];
  const checkedCount = itemLines.filter((line) => line.startsWith("- [x]")).length;
  const totalCount = itemLines.length;
  return content.replace(
    /- 清单通过率:\s*`?.*`?/,
    `- 清单通过率: \`${checkedCount}/${totalCount}\``
  );
}

if (!fs.existsSync(checklistPath)) {
  console.error(`[test:checklist] Checklist file not found: ${checklistPath}`);
  process.exit(1);
}

const testPassed = runNpmScript("test");
const coveragePassed = runNpmScript("test:coverage");

let content = fs.readFileSync(checklistPath, "utf8");
content = updateAutomatedItems(content, testPassed, coveragePassed);
content = updatePassRate(content);

fs.writeFileSync(checklistPath, content, "utf8");

if (!testPassed || !coveragePassed) {
  console.error("[test:checklist] Updated checklist, but some test commands failed.");
  process.exit(1);
}

console.log("[test:checklist] Updated E1/E2 and pass rate successfully.");

