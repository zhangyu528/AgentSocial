const fs = require("fs");
const path = require("path");

const checklistPath = path.resolve(
  __dirname,
  "..",
  "docs",
  "FUNCTIONAL_TEST_CHECKLIST.md"
);

function fail(message) {
  console.error(`[check:test-checklist] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(checklistPath)) {
  fail(`Checklist file not found: ${checklistPath}`);
}

const content = fs.readFileSync(checklistPath, "utf8");

if (/- \[ \]/.test(content)) {
  fail("Checklist contains unchecked items (- [ ]).");
}

const recommendationMatch = content.match(/发布建议:\s*(.+)/);
if (!recommendationMatch) {
  fail("Missing '发布建议' field.");
}

const recommendation = recommendationMatch[1].trim();
if (recommendation !== "通过") {
  fail(`发布建议 must be '通过', got '${recommendation}'.`);
}

const passRateMatch = content.match(/清单通过率:\s*`?(\d+)\/(\d+)`?/);
if (!passRateMatch) {
  fail("Missing or invalid '清单通过率' format. Expect N/N.");
}

const passed = Number(passRateMatch[1]);
const total = Number(passRateMatch[2]);
if (passed !== total) {
  fail(`清单通过率 must be full pass, got ${passed}/${total}.`);
}

console.log("[check:test-checklist] Checklist validation passed.");


