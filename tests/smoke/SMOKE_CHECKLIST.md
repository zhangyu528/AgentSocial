# Real-chain Smoke Checklist (Functional View)

范围：使用真实飞书凭证与真实链路，验证发布/运行环境可用性。

## S0. 前置条件

- [ ] S0.1 已配置真实凭证环境变量。
  通过标准: `FEISHU_APP_ID`、`FEISHU_APP_SECRET` 已配置且可用。
  自动化来源: 发布 workflow 的 secret 校验步骤

- [ ] S0.2 [MANUAL] 测试租户/目标会话可用。
  通过标准: 测试账号可访问目标应用与目标会话。
  自动化来源: 飞书后台/测试租户手工确认

## S1. 诊断与权限

- [ ] S1.1 真实链路 smoke 命令执行成功。
  通过标准: `npm run test:smoke` 退出码为 0。
  自动化来源: `npm run test:smoke`

- [ ] S1.2 关键能力与 scope 诊断通过。
  通过标准: `BOT_CAPABILITY`、`SCOPE_*` 关键项均为 `status=true`。
  自动化来源: `tests/smoke/feishu-real-chain.smoke.test.ts`

## S2. 消息发送与证据

- [ ] S2.1 配置 `FEISHU_SMOKE_CHAT_ID` 时可发送真实消息。
  通过标准: 目标 chat 中成功收到 smoke 消息。
  自动化来源: `tests/smoke/feishu-real-chain.smoke.test.ts`

- [ ] S2.2 [MANUAL] 运行日志具备可追溯证据。
  通过标准: 日志包含执行时间、目标、结果。
  自动化来源: workflow logs + runtime logs

## S3. 事件订阅与回调（真实链路）

- [ ] S3.1 [MANUAL] 事件订阅开关已开启。
  通过标准: `im.message.receive_v1` 在飞书后台为启用状态。
  自动化来源: 飞书管理后台截图/记录

- [ ] S3.2 [MANUAL] 卡片回调开关已开启。
  通过标准: `card.action.trigger` 在飞书后台为启用状态。
  自动化来源: 飞书管理后台截图/记录

- [ ] S3.3 [MANUAL] 已完成一次真实卡片回调交互。
  通过标准: approve/deny 任一动作触发成功并有日志证据。
  自动化来源: 运行日志 + 操作记录

## S4. 回归基线

- [ ] S4.1 发布 workflow 中 smoke 门禁通过。
  通过标准: 发布流程未在 smoke gate 阶段失败。
  自动化来源: `.github/workflows/publish.yml`

- [ ] S4.2 定时 smoke 任务稳定运行。
  通过标准: 定时任务持续成功，无连续失败。
  自动化来源: `.github/workflows/smoke-real-chain.yml`

## Notes

- 环境:
- 日期:
- 审核人:
- 问题记录:
