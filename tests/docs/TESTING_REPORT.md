# AgentSocial 测试报告（简版）

## 1. 测试范围

- 单元测试：`tests/unit/basic.test.ts`、`tests/unit/setup-utils.test.ts`、`tests/unit/config-manager.test.ts`
- 集成测试：`tests/integration/run-functional.test.ts`、`tests/integration/feishu-diagnose.test.ts`
- 覆盖率报告：`npm run test:coverage`

## 2. 当前结果

- `npm test`：`5/5` Suites 通过，`20/20` Tests 通过
- `npm run test:coverage`：执行成功并生成报告（`tests/coverage/`）
- 发布门禁：
  - 本地 `pre-push`: `npm run pre-push:quality`
  - CI/发布: `npm run test:checklist` -> `npm run check:test-checklist`

## 3. 已知风险与限制

- 覆盖率已产出，但总覆盖率仍偏低，需要按模块持续补测。
- 功能项（A-D、E3、E4）依赖人工验证与勾选，不由自动化测试替代。

## 4. 关联清单

- 发布准入以 `tests/docs/FUNCTIONAL_TEST_CHECKLIST.md` 为准。
- 建议流程：先执行 `npm run test:checklist`，再完成人工项勾选，最后执行 `npm run check:test-checklist`。



