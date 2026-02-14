# 功能测试 Checklist

发布前请将本清单与覆盖率报告（`npm run test:coverage`）一起作为测试准入条件。

## 基本信息

- 测试日期:
- 测试人:
- 分支 / 提交:
- 测试环境:
- 操作系统:
- Node.js 版本:
- Agent CLI 类型与版本（Gemini/Codex/Claude）:

## A. Setup 流程

A0. 目标（说明项，不勾选）：`setup` 在全新环境可稳定落盘、可诊断、可重复执行。

- [x] A1. 首次 setup 成功与可观测性（场景）。
  验证方式: 自动化
  证据来源: `tests/integration/setup-first-run.e2e.test.ts`
  通过标准: A1.1~A1.4 全通过。
  优先级: P0
- [x] A1.1 首次执行 `setup` 进程退出码为 0。
  验证方式: 自动化
  证据来源: `tests/integration/setup-first-run.e2e.test.ts`
  通过标准: `result.status === 0`。
- [x] A1.2 首次执行标准输出包含成功提示。
  验证方式: 自动化
  证据来源: `tests/integration/setup-first-run.e2e.test.ts`
  通过标准: stdout 包含 `Configuration Complete` 与 `saved to ~/.agentsocial/settings.json`。
- [x] A1.3 首次执行过程中不出现错误级输出（Error/❌）。
  验证方式: 自动化
  证据来源: `tests/integration/setup-first-run.e2e.test.ts`
  通过标准: `stderr.trim() === ''`。
- [x] A1.4 首次执行在合理时间窗口内完成（无卡死/超时）。
  验证方式: 自动化
  证据来源: `tests/integration/setup-first-run.e2e.test.ts`
  通过标准: 单次执行耗时 `< 15000ms`。

- [x] A2. 配置文件可读（场景）。
  验证方式: 自动化
  证据来源: `tests/unit/config-manager.test.ts`
  通过标准: A2.1~A2.2 全通过。
  优先级: P0
- [x] A2.1 已存在的 `settings.json` 可被正确读取。
  验证方式: 自动化
  证据来源: `tests/unit/config-manager.test.ts`
  通过标准: `getSettings()` 返回与写入一致的数据结构。
- [x] A2.2 `settings.json` 损坏（非法 JSON）时安全返回空数组。
  验证方式: 自动化
  证据来源: `tests/unit/config-manager.test.ts`
  通过标准: `getSettings()` 返回 `[]`，不抛异常。

- [x] A3. 凭证合法性校验（场景）。
  验证方式: 自动化
  证据来源: `tests/unit/setup-validation.test.ts` + `tests/integration/setup-invalid-credentials.e2e.test.ts`
  通过标准: A3.1~A3.3 全通过。
  优先级: P0
- [x] A3.1 非法 `app_id` 会被拒绝并给出明确报错。
  验证方式: 自动化
  证据来源: `tests/unit/setup-validation.test.ts`
  通过标准: `result.valid === false` 且错误信息包含 `App ID 格式非法`。
- [x] A3.2 非法 `app_secret` 会被拒绝并给出明确报错。
  验证方式: 自动化
  证据来源: `tests/unit/setup-validation.test.ts`
  通过标准: `result.valid === false` 且错误信息包含 `App Secret 格式非法`。
- [x] A3.3 非法凭证在 CLI 进程级返回非 0 并输出明确错误。
  验证方式: 自动化
  证据来源: `tests/integration/setup-invalid-credentials.e2e.test.ts`
  通过标准: `exit code = 1` 且 `stderr` 包含 `setup failed` 与 `凭证校验失败`。

- [ ] A4. 飞书配置诊断有效性（场景）。
  验证方式: 自动化 + 人工
  证据来源: `tests/integration/feishu-diagnose.test.ts`
  通过标准: A4.1~A4.3 全通过。
  优先级: P1
- [x] A4.1 诊断流程能识别 scopes 缺失。
  验证方式: 自动化
  证据来源: `tests/integration/feishu-diagnose.test.ts`
  通过标准: 缺失权限时对应报告项 `status=false` 且含修复 hint。
- [x] A4.2 诊断流程能识别机器人能力未启用。
  验证方式: 自动化
  证据来源: `tests/integration/feishu-diagnose.test.ts`
  通过标准: 机器人禁用场景下第一步拦截并返回可执行 hint。
- [ ] A4.3 事件订阅/回调开关状态已确认。
  验证方式: 人工
  证据来源: 飞书后台配置页面
  通过标准: `im.message.receive_v1` 与 `card.action.trigger` 已开启。

- [x] A5. 首次 setup 目录结构正确（场景）。
  验证方式: 自动化
  证据来源: `tests/unit/setup-first-run-config.test.ts`
  通过标准: A5.1~A5.2 全通过。
  优先级: P1
- [x] A5.1 首次执行会创建 `~/.agentsocial` 根目录。
  验证方式: 自动化
  证据来源: `tests/unit/setup-first-run-config.test.ts`
  通过标准: 目标目录存在且为目录。
- [x] A5.2 首次执行会创建 `settings.json`，且 JSON 格式合法。
  验证方式: 自动化
  证据来源: `tests/unit/setup-first-run-config.test.ts`
  通过标准: 文件存在且 JSON 可解析为数组。

- [x] A6. setup 幂等性（场景）。
  验证方式: 自动化
  证据来源: `tests/integration/setup-idempotent.e2e.test.ts`
  通过标准: A6.1~A6.2 全通过。
  优先级: P1
- [x] A6.1 重复执行 `setup` 不产生脏状态（不重复追加同一 app）。
  验证方式: 自动化
  证据来源: `tests/integration/setup-idempotent.e2e.test.ts`
  通过标准: 同一 `platform+app_id` 连续执行两次后 `settings.json` 仅 1 条记录。
- [x] A6.2 重复执行 `setup` 会更新同一 app 配置，不影响记录数量。
  验证方式: 自动化
  证据来源: `tests/integration/setup-idempotent.e2e.test.ts`
  通过标准: 同一 `platform+app_id` 二次执行后仍 1 条记录，字段值更新为最新输入。

## B. Run 流程

- [x] B1. 单行消息中 @机器人 + 指令可正确解析。
  自动化来源: `tests/integration/run-functional.test.ts`
- [x] B2. 多行消息可保留有效指令内容。
  自动化来源: `tests/integration/run-functional.test.ts`
- [x] B3. 不同 chatId 映射到隔离 workspace。
  自动化来源: `tests/integration/run-functional.test.ts`
- [x] B4. `plan` 模式命令包含 `--approval-mode plan`。
  自动化来源: `tests/integration/run-functional.test.ts`
- [ ] B5. `auto` 模式仅在显式选择后才使用高权限参数。
  自动化来源: `tests/integration/run-functional.test.ts`（显式选择触发条件为人工补充确认）
- [ ] B6. 命令执行结果可正确回传到飞书消息/卡片。

## C. 异常处理

- [ ] C1. Agent 进程启动失败时，返回可操作的错误信息。
- [ ] C2. 超时或网络异常不会导致服务崩溃。
- [x] C3. 飞书 API 异常路径有用户可见的诊断反馈。
  自动化来源: `tests/integration/feishu-diagnose.test.ts`
- [ ] C4. 空事件或非法事件输入可安全忽略。

## D. 安全与护栏

- [ ] D1. 满足 Fail-Closed：鉴权/权限不确定时默认拒绝。
- [ ] D2. 日志中不泄露 token/secret 等敏感信息。
- [ ] D3. Session 路径不会逃逸工作目录根路径。
- [ ] D4. 模式切换（Plan -> Auto）需要明确用户动作触发。

## E. 回归冒烟

- [x] E1. `npm test` 全量通过。
  自动化来源: `npm test`
- [x] E2. `npm run test:coverage` 成功并生成报告。
  自动化来源: `npm run test:coverage`
- [ ] E3. 至少 1 条端到端功能场景手工验证通过。
- [ ] E4. pre-push hook 仍按预期生效。

## 结论签字

- 清单通过率: `24/37`
- 阻塞问题:
- 发布建议: 通过 / 暂缓
