# Unit Test Checklist (Functional View)

Scope: unit-level functional behaviors and guardrails. Each item is written as a feature expectation, with pass criteria and automation source.

## U0. 基础约束

- [x] U0.1 单元测试需可离线执行，不依赖真实飞书网络。
  通过标准: 测试使用 mock/stub，CI 环境稳定通过。
  自动化来源: `npm run test:unit`

## U1. 凭证与输入校验

- [x] U1.1 `app_id` 格式非法时被拒绝。
  通过标准: `valid=false` 且错误信息包含 `App ID 格式非法`。
  自动化来源: `tests/unit/setup-validation.test.ts`

- [x] U1.2 `app_secret` 格式非法时被拒绝。
  通过标准: `valid=false` 且错误信息包含 `App Secret 格式非法`。
  自动化来源: `tests/unit/setup-validation.test.ts`

- [x] U1.3 空 `app_id/app_secret` 给出明确报错。
  通过标准: `valid=false` 且同时包含“不能为空”错误信息。
  自动化来源: `tests/unit/setup-validation.test.ts`

## U2. 配置读写与幂等

- [x] U2.1 可正确读取已存在配置。
  通过标准: `getSettings()` 返回与落盘一致的数据结构。
  自动化来源: `tests/unit/config-manager.test.ts`

- [x] U2.2 配置文件损坏时安全降级。
  通过标准: 非法 JSON 场景返回 `[]`，不抛异常。
  自动化来源: `tests/unit/config-manager.test.ts`

- [x] U2.3 保存配置时支持按 `platform+app_id` 去重更新。
  通过标准: 同 key 不新增重复记录，字段按最新输入更新。
  自动化来源: `tests/unit/config-manager.test.ts`

- [x] U2.4 删除与更新指定 app 配置行为正确。
  通过标准: `remove/update` 仅影响目标记录，不误伤其他配置。
  自动化来源: `tests/unit/config-manager.test.ts`

## U3. 初始化与目录结构

- [x] U3.1 首次运行会创建 `~/.agentsocial` 根目录。
  通过标准: 目录存在且类型正确。
  自动化来源: `tests/unit/setup-first-run-config.test.ts`

- [x] U3.2 首次运行会创建合法 `settings.json`。
  通过标准: 文件存在且可解析为数组。
  自动化来源: `tests/unit/setup-first-run-config.test.ts`

- [x] U3.3 setup 工具函数在不同输入下行为稳定。
  通过标准: 无异常分支遗漏，返回值符合预期。
  自动化来源: `tests/unit/setup-utils.test.ts`

## U4. CLI 解析与路由

- [x] U4.1 `-h/--help` 与空参可正确路由到帮助。
  通过标准: 解析结果 action 为 `help`。
  自动化来源: `tests/unit/cli-args.test.ts`

- [x] U4.2 `run/setup/config` 子命令解析正确。
  通过标准: action、mode、options 映射正确。
  自动化来源: `tests/unit/cli-args.test.ts`

- [x] U4.3 非法参数组合会返回清晰错误。
  通过标准: errors 列表包含明确提示，不静默失败。
  自动化来源: `tests/unit/cli-args.test.ts`

## U5. 版本与回归基线

- [x] U5.1 版本信息读取与格式化逻辑正确。
  通过标准: 版本字段存在且符合预期格式。
  自动化来源: `tests/unit/version.test.ts`

- [x] U5.2 单测套件在 CI 中稳定通过。
  通过标准: `npm run test:unit` 通过，且无随机失败。
  自动化来源: CI `test:unit` job

## Notes

- 待补单测项:
- 回归风险记录:
