# Testing Strategy

## Naming

Use **Strategy** instead of **Scheme**.

- `Strategy`: long-term testing approach, layering, and release gates.
- `Scheme`: usually sounds like a temporary plan or implementation detail.

## Scope

This strategy defines how AgentSocial validates quality across unit, integration, contract, local e2e, and real-chain smoke.

## Test Layers

1. Unit (`tests/unit`)
- Goal: pure logic correctness and edge-case validation.
- Command: `npm run test:unit`
- Checklist: `tests/unit/UNIT_CHECKLIST.md`

2. Integration (`tests/integration`)
- Goal: module collaboration with mocked external dependencies.
- Command: `npm run test:integration`
- Checklist: `tests/integration/INTEGRATION_CHECKLIST.md`

3. Contract (`tests/contract`)
- Goal: payload/field contract stability, preventing event schema drift from breaking parsing.
- Command: `npm run test:contract`
- Samples: `tests/contract/payloads/*.json`
- Checklist: `tests/contract/CONTRACT_CHECKLIST.md`

4. Local E2E (`tests/e2e/local`)
- Goal: process-level end-to-end flow without real external chain.
- Command: `npm run test:e2e`
- Checklist: `tests/e2e/local/E2E_LOCAL_CHECKLIST.md`

5. Real-chain Smoke (`tests/smoke`)
- Goal: verify real Feishu chain and release readiness.
- Command: `npm run test:smoke`
- Checklist: `tests/smoke/SMOKE_CHECKLIST.md`
- Runbook: `tests/docs/SMOKE_GUIDE.md`

## Release Gates

Master gate file: `tests/MASTER_RELEASE_CHECKLIST.md`

- MR1: unit checklist/pass status
- MR2: integration checklist/pass status
- MR3: local e2e checklist/pass status
- MR4: real-chain smoke checklist/pass status

## Workflow Policy

1. CI (`.github/workflows/ci.yml`)
- Run lint + build + unit + integration + contract + local e2e.

2. Publish (`.github/workflows/publish.yml`)
- Run release smoke test.
- Publish package only after smoke passes.

3. Scheduled Smoke (`.github/workflows/smoke-real-chain.yml`)
- Nightly health check in real chain.

## Local Developer Flow

- Pre-push hook: `.husky/pre-push`
- Command: `npm run checklists:sync`
- Behavior:
  - Run unit + integration + contract + local e2e
  - Sync checklist auto items
  - Smoke runs only when real smoke credentials are present (`FEISHU_APP_ID` + `FEISHU_APP_SECRET`)

## Notes

- Checklist files are governance artifacts; test commands are enforcement artifacts.
- Manual items remain in real-chain smoke where platform state cannot be fully mocked.
