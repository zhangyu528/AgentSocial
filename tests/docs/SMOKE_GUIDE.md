# Smoke Guide

本指南用于说明 AgentSocial 的真实链路 Smoke 测试。

## 目标

使用真实飞书凭证验证以下关键能力：

- 应用鉴权可用
- 关键 Scope 已生效
- （可选）真实会话消息发送可用
- 发布前真实链路可用性门禁

## 对应测试

- 测试文件: `tests/smoke/feishu-real-chain.smoke.test.ts`
- 清单文件: `tests/smoke/SMOKE_CHECKLIST.md`
- 命令: `npm run test:smoke`

## 本地运行

```powershell
$env:FEISHU_APP_ID="cli_xxx"
$env:FEISHU_APP_SECRET="xxx"
npm run test:smoke
```

可选变量：

- `FEISHU_SMOKE_REQUIRED`
  - 默认值: `BOT_CAPABILITY,SCOPE_READ_MESSAGE,SCOPE_READ_CHAT,SCOPE_APP_INFO`
  - 示例: `BOT_CAPABILITY,SCOPE_READ_CHAT`
- `FEISHU_SMOKE_CHAT_ID`
  - 配置后会额外执行一次真实消息发送验证

## CI / 发布策略

1. PR CI 不跑 smoke（只跑 unit/integration/contract/local e2e）。
2. 发布流程必须跑 smoke（`publish.yml` 门禁）。
3. 定时任务每日巡检真实链路（`smoke-real-chain.yml`）。

## 通过标准

1. `diagnose()` 关键检查项均为 `status=true`。
2. 若配置 `FEISHU_SMOKE_CHAT_ID`，真实消息发送成功。
3. 发布流程中 smoke 步骤通过。

## 仍需人工确认的项

以下项保留在 `tests/smoke/SMOKE_CHECKLIST.md`：

- 事件订阅开关（`im.message.receive_v1`）
- 卡片回调开关（`card.action.trigger`）
- 至少一次真实卡片回调交互证据

