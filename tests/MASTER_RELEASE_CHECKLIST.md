# Master Release Checklist

Master only contains release gates and links to type-specific checklists.
Detailed test items are maintained only in their own checklist files.

## Checklist Ownership

- Unit-only items: `tests/unit/UNIT_CHECKLIST.md`
- Integration-only items: `tests/integration/INTEGRATION_CHECKLIST.md`
- Contract-only items: `tests/contract/CONTRACT_CHECKLIST.md`
- Local process e2e items: `tests/e2e/local/E2E_LOCAL_CHECKLIST.md`
- Real-chain smoke items: `tests/smoke/SMOKE_CHECKLIST.md`

## Release Gates

- [x] MR1. Unit checklist result is PASS.
  Verification: automated + reviewer confirmation
  Evidence: `tests/unit/UNIT_CHECKLIST.md` + CI logs
- [x] MR2. Integration checklist result is PASS.
  Verification: automated + reviewer confirmation
  Evidence: `tests/integration/INTEGRATION_CHECKLIST.md` + CI logs
- [x] MR3. Local E2E checklist result is PASS.
  Verification: automated + reviewer confirmation
  Evidence: `tests/e2e/local/E2E_LOCAL_CHECKLIST.md` + CI logs
- [ ] MR4. Real-chain smoke checklist result is PASS.
  Verification: automated + manual confirmation
  Evidence: `tests/smoke/SMOKE_CHECKLIST.md` + workflow logs

## Release Metadata

- Date:
- Reviewer:
- Branch / Commit:
- Environment:
- Notes:

## Final Decision

- Blocking issues:
- Publish recommendation: PASS / HOLD
