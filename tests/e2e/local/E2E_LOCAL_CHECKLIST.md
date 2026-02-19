# Local E2E Checklist (Functional View)

Scope: local process-level end-to-end behavior (CLI + process flow), without requiring real Feishu external chain.

## E1. Setup 首次执行

- [x] E1.1 首次 `setup apply` 返回成功退出码。
  通过标准: 进程 `status===0`。
  自动化来源: `tests/e2e/local/setup-first-run.e2e.test.ts`

- [x] E1.2 首次 `setup apply` 输出成功提示。
  通过标准: stdout 包含 `Configuration Complete` 与配置落盘提示。
  自动化来源: `tests/e2e/local/setup-first-run.e2e.test.ts`

- [x] E1.3 首次执行无错误级输出且在时限内完成。
  通过标准: `stderr` 干净，耗时低于约定阈值。
  自动化来源: `tests/e2e/local/setup-first-run.e2e.test.ts`

## E2. Setup 幂等与更新

- [x] E2.1 重复执行 `setup apply` 不产生重复配置。
  通过标准: 同一 app 只保留 1 条记录。
  自动化来源: `tests/e2e/local/setup-idempotent.e2e.test.ts`

- [x] E2.2 重复执行会更新原记录而非新增。
  通过标准: 记录数不变，字段值更新为最新输入。
  自动化来源: `tests/e2e/local/setup-idempotent.e2e.test.ts`

## E3. 非法输入保护

- [x] E3.1 非法 `app_id/app_secret` 返回非 0 并提示明确错误。
  通过标准: 退出码非 0，stderr 包含可识别错误信息。
  自动化来源: `tests/e2e/local/setup-invalid-credentials.e2e.test.ts`

## E4. Config 命令链路

- [x] E4.1 `config list` 能列出现有配置。
  通过标准: 输出包含已保存 app 配置。
  自动化来源: `tests/e2e/local/config-command.e2e.test.ts`

- [x] E4.2 `config update` 能更新目标配置。
  通过标准: 输出成功提示且落盘值更新。
  自动化来源: `tests/e2e/local/config-command.e2e.test.ts`

- [x] E4.3 `config remove` 能删除目标配置。
  通过标准: 输出成功提示且目标记录被移除。
  自动化来源: `tests/e2e/local/config-command.e2e.test.ts`

## E5. 回归基线

- [x] E5.1 本地 e2e 套件在 CI 稳定通过。
  通过标准: `npm run test:e2e` 通过且无随机失败。
  自动化来源: CI `test:e2e` job

## Notes

- 待补 e2e 项:
- 回归风险记录:
