# AgentSocial Codex Memory

Last updated: 2026-02-16 (Asia/Shanghai context)

## Project Summary

- Type: Node.js + TypeScript CLI service.
- Goal: Bridge local AI agents (gemini/claude/codex) with Feishu interactions.
- Runtime entry: `src/main.ts`
- Package/bin:
  - npm package: `@zhangyu528/agentsocial`
  - CLI bin: `agentsocial`

## Core Code Map

- `src/main.ts`
  - CLI action router (`setup`, `run`, `config`, `version`, `help`)
  - startup orchestration and dependency checks
- `src/core/config-manager.ts`
  - global settings persistence (`~/.agentsocial/settings.json`)
  - supports `AGENTSOCIAL_HOME` override
- `src/platforms/feishu-bot.ts`
  - Feishu websocket event handling
  - card action callback handling
  - callback dedupe via processed action keys
- `src/services/feishu-api.ts`
  - Feishu REST API wrapper and diagnostics
- `src/core/queue.ts`
  - serialized execution model for tasks

## Test Strategy (Current Canonical)

Reference doc: `tests/docs/TESTING_STRATEGY.md`

Layers and commands:

1. Unit: `npm run test:unit` (`tests/unit`)
2. Integration: `npm run test:integration` (`tests/integration`)
3. Contract: `npm run test:contract` (`tests/contract`)
4. Local E2E: `npm run test:e2e` (`tests/e2e/local`)
5. Real-chain Smoke: `npm run test:smoke` (`tests/smoke`)

Release gate checklist:

- Master: `tests/MASTER_RELEASE_CHECKLIST.md`
- Layer checklists:
  - `tests/unit/UNIT_CHECKLIST.md`
  - `tests/integration/INTEGRATION_CHECKLIST.md`
  - `tests/contract/CONTRACT_CHECKLIST.md`
  - `tests/e2e/local/E2E_LOCAL_CHECKLIST.md`
  - `tests/smoke/SMOKE_CHECKLIST.md`

Checklist sync:

- Script: `tests/scripts/update-checklists.js`
- Command: `npm run checklists:sync`
- Hook: `.husky/pre-push` runs sync before push.
- Smoke in sync is conditional: only runs when both `FEISHU_APP_ID` and `FEISHU_APP_SECRET` are present.

## Workflow Policy

CI:

- File: `.github/workflows/ci.yml`
- Trigger: `pull_request` to `main`
- Runs: lint, build, unit, integration, contract, local e2e

Publish:

- File: `.github/workflows/publish.yml`
- Trigger: `release.published`
- Runs: lint, build, smoke gate, then publish
- No extra CI re-check in publish (relies on branch protection + PR CI)

Scheduled smoke:

- File: `.github/workflows/smoke-real-chain.yml`
- Trigger: cron only (`0 18 * * *` UTC; 02:00 Beijing)
- Runs real-chain smoke daily

## Real Smoke Env

Required:

- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`

Optional:

- `FEISHU_SMOKE_REQUIRED` (comma-separated diagnose keys)
- `FEISHU_SMOKE_CHAT_ID` (send real message check)

Note:

- `FEISHU_SMOKE_E2E` is deprecated and removed from current flow.

## Conventions for Future Changes

- Prefer adding tests in the matching layer directory instead of mixed placement.
- Keep smoke tests isolated under `tests/smoke`.
- Keep workflow names/file names aligned with real behavior (no stale `*e2e*` naming for smoke-only real-chain jobs).
- Update corresponding checklist docs when adding or changing release-critical behavior.
- For text docs on Windows, keep UTF-8 encoding consistent to avoid mojibake.

## Known Risks / Follow-ups

- Some source/docs still contain legacy mojibake strings from prior encoding issues.
- If touching those files, normalize encoding in the same change to avoid repeated corruption.
- Keep `tests/docs/TESTING_STRATEGY.md` consistent with actual workflow behavior when policy changes.
