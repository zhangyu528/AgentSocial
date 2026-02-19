# Integration Test Checklist (Functional View)

Scope: cross-module functional behavior with mocked external dependencies (no real Feishu chain required).

## I1. 飞书诊断与权限映射

- [x] I1.1 诊断流程在“全部权限正常”场景返回全通过。
  通过标准: `diagnose()` 报告关键项全部 `status=true`。
  自动化来源: `tests/integration/feishu-diagnose.test.ts`

- [x] I1.2 诊断流程可识别机器人能力未开启并给出提示。
  通过标准: `BOT_CAPABILITY` 项 `status=false` 且含可执行 hint。
  自动化来源: `tests/integration/feishu-diagnose.test.ts`

- [x] I1.3 诊断流程可识别 scope 缺失并映射修复提示。
  通过标准: 目标 scope 项 `status=false` 且 hint 正确。
  自动化来源: `tests/integration/feishu-diagnose.test.ts`

## I2. 指令解析与会话隔离

- [x] I2.1 @机器人提及可被正确剔除，指令内容保真。
  通过标准: mention 删除后文本正确、首尾空白修整正确。
  自动化来源: `tests/integration/run-parsing.integration.test.ts`

- [x] I2.2 多行消息内部换行保留且可执行。
  通过标准: 多行文本结构保持，仅首尾裁剪。
  自动化来源: `tests/integration/run-parsing.integration.test.ts`

- [x] I2.3 同 app 不同 chatId 的 workspace 隔离正确。
  通过标准: 路径不同，且命中 chatId 的 MD5 规则。
  自动化来源: `tests/integration/run-parsing.integration.test.ts`

## I3. 运行模式行为

- [x] I3.1 plan 模式命令参数正确。
  通过标准: 包含 `--approval-mode plan` 及计划引导语。
  自动化来源: `tests/integration/run-mode.integration.test.ts`

- [x] I3.2 auto 模式命令参数正确。
  通过标准: 包含 `--yolo` 与 `--resume latest`。
  自动化来源: `tests/integration/run-mode.integration.test.ts`

## I4. 队列与回调关键行为

- [x] I4.1 同一 `appId+chatId` 队列串行执行。
  通过标准: 同 key 任务不并发，按入队顺序执行。
  自动化来源: `tests/integration/queue-behavior.test.ts`

- [x] I4.2 不同 `chatId` 队列可并行执行。
  通过标准: 不同 key 任务互不阻塞。
  自动化来源: `tests/integration/queue-behavior.test.ts`

- [x] I4.3 审批回调分支（approve/deny/execute_plan）行为正确。
  通过标准: 各分支触发目标动作且卡片状态更新正确。
  自动化来源: `tests/integration/feishu-callback.integration.test.ts`

- [x] I4.4 卡片回调幂等性（重复投递不重复执行）。
  通过标准: 同一回调多次投递只生效一次。
  自动化来源: `tests/integration/feishu-callback.integration.test.ts`

## I5. 回归基线

- [x] I5.1 集成测试套件在 CI 稳定通过。
  通过标准: `npm run test:integration` 通过且无随机失败。
  自动化来源: CI `test:integration` job

## Notes

- 待补集成项:
- 回归风险记录:
