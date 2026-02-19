# Contract Test Checklist (Functional View)

范围：验证事件 payload / 协议契约稳定性，避免字段漂移导致运行时故障。

## C0. 前置约束

- [ ] C0.1 契约测试不依赖真实飞书网络。
  通过标准: 使用本地 payload 样本与 mock，CI 可稳定执行。
  自动化来源: `npm run test:contract`

## C1. payload 字段契约

- [ ] C1.1 `im.message.receive_v1` 必需字段完整。
  通过标准: `message_id/message_type/chat_id/chat_type/content/sender.sender_id.open_id` 均存在。
  自动化来源: `tests/contract/feishu-events.contract.test.ts`

- [ ] C1.2 `card.action.trigger` 必需字段完整。
  通过标准: `action.value.action_id/chat_id/original_cmd/context.open_message_id` 均存在。
  自动化来源: `tests/contract/feishu-events.contract.test.ts`

## C2. 契约兼容行为

- [ ] C2.1 `im.message.receive_v1` 样本可被处理且无运行时异常。
  通过标准: 事件处理完成且命中目标指令处理分支。
  自动化来源: `tests/contract/feishu-events.contract.test.ts`

- [ ] C2.2 `card.action.trigger` 重复投递具备幂等性。
  通过标准: 同一 payload 重复提交仅生效一次。
  自动化来源: `tests/contract/feishu-events.contract.test.ts`

## C3. 回归基线

- [ ] C3.1 契约测试套件在 CI 稳定通过。
  通过标准: `npm run test:contract` 通过且无随机失败。
  自动化来源: CI `test:contract` job

## Notes

- 待补契约项:
- 版本变更记录:
