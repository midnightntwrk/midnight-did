# Repository Maturity Backlog (Midnight DID / VC dev workflow)

## Status
- ✅ Added repository boundary declaration: `docs/repository-boundary.md`
- ✅ Added workspace manifest guard: `scripts/validate-workspace-manifests.js`
- ✅ Added boundary checks and cleanup scripts in `package.json`
- ✅ Modernized `run.sh` with explicit step matrix + `--metrics` + `--skip-coverage`
- ✅ CI now runs strict pipeline mode (`npm run run:strict`)

## Next 10 important improvements

1. ✅ **Done: Add repository audit report command**
   - Added `npm run audit:repo` (`scripts/repository-audit.mjs`) for workspace manifest/script checks and boundary detection.
   - Current command currently prints text output by default; JSON mode available via `--json`.

2. ✅ **Done: Add script-level contract tests for `run.sh` modes**
   - Introduce small shell tests (e.g. bats) covering `--help`, `--strict`, `--metrics`, `--skip-coverage`, and malformed args.
   - Implemented as `scripts/run-sh-contract.test.mjs` executed via `npm run test:run-sh`.

3. ✅ **Done: Split coverage from core CI path with allowlist**
   - CI now runs `run:fast` for push/pull_request/dispatch and keeps full `run:strict` with coverage only on scheduled runs.

4. ✅ **Done: Fail-fast API/CLI dependencies check in dev environment**
   - Added `scripts/check-workspace-dependencies.mjs` and wired `run.sh` to run it before heavy steps.
   - `run.sh` now exits early when workspace manifests or required scripts drift.

5. ✅ **Done: Formalize workspace contract for each package**
   - `scripts/repository-audit.mjs` now enforces required workspace scripts `lint`, `build`, `test`, `coverage`, and `lint:fix`.
   - Added `cli` `test` script alias (`npm run test-api`) so all workspaces satisfy the contract.

6. ✅ **Done: Add deterministic timing artifact export**
  - Add `--metrics-json <path>` option to `run.sh` and publish artifacts in CI for trend analysis.
  - CI now executes `run.sh` with `--metrics-json` in both fast and strict pipelines and publishes JSON artifacts.

7. ✅ **Done: Introduce a root-level `npx`/`npm` sanity task**
   - Added `npm run check:toolchain` with root precheck logic in `scripts/check-toolchain.mjs`.
   - `run.sh` executes this precheck before patching and heavy pipeline work.
   - Added in [`scripts/check-toolchain.mjs`](/Users/ysh/iohk/midnight-did/scripts/check-toolchain.mjs) and wired via `run.sh` (`node scripts/check-toolchain.mjs`).

8. ✅ **Done: Tighten CI smoke targets**
   - Added `run-pipeline-fast` (`push`/`pull_request`/`workflow_dispatch`) with quick boundary checks and `npm run run:fast`.

9. ✅ **Done: Unify documentation and script discoverability**
  - Added role-specific contributor workflows in `CONTRIBUTING.md`.
  - Added `docs/midnight-did-book-for-dummies.md` into README as a practical entry point for user-case based specs.

10. **Backlog-driven cross-repo review loop**
    - After each PR, run manual or assistant review pass and update this backlog with blocked/investigated items.
    - This should include a short post-PR note on stale/legacy directories touched or newly introduced.

## Next 10 backlog items (stackable PR slices)

11. ✅ **Done: Implement fail-fast API/CLI dependency drift precheck**
   - Add a startup script that validates workspace package boundaries, required scripts, and expected tool versions before full pipeline execution.
   - Acceptance: `./run.sh` aborts early with actionable hints when a known drift is detected.

12. ✅ **Done: Implement deterministic metrics export in `run.sh`**
   - Add `--metrics-json <path>` to persist per-step timings in machine-readable format.
   - Acceptance: CI publishes a metrics artifact and local runs write valid JSON with stable keys.

13. ✅ **Done: Publish contributor workflow matrix in `CONTRIBUTING.md`**
   - Add role-based local workflows: issue triage, feature work, release, and CI triage.
   - Acceptance: README and CONTRIBUTING have aligned command paths for each role.

14. **Create structured spec-to-implementation matrix**
   - Add `docs/midnight-did-spec-matrix.yaml` (or `.json`) linking every use case section to implementation status, risk, and owner.
   - Acceptance: reviewers can verify status in one file before writing or merging PRs.

15. **Add canonical compact VC schema package**
   - Introduce agreed credential type definitions for identity, role, and compliance flows.
   - Acceptance: shared schema module compiles, includes examples, and exports canonical hash test vectors.

16. **Add VC status/reference baseline**
   - Add soft status workflow in API/service layer plus revocation state fixture format.
   - Acceptance: same credential in revoked state is rejected by verifier tests.

17. **Add issuer/verifier trust registry contract scaffold**
   - Add role assignment, expiry windows, and role-history querying.
   - Acceptance: at least two contract tests cover `issuer` and `verifier` role transitions.

18. **Add DID role delegation + capability template**
   - Provide a documented delegation template for agents and operational services.
   - Acceptance: delegated key rotation and revoke path is demonstrated in tests.

19. **Add university-style presentation/issuance BDD slices**
   - Create deterministic fixtures and scenario flow for student-issued diploma, verifier checks, and rejection path.
   - Acceptance: scenario validates request/response/decision logs and exports timing artifacts.

20. **Add PR-ready governance for stackable review**
   - Add a short PR template and review checklist for use-case-related changes.
   - Acceptance: checklists require matrix link, scenario coverage, and status update in the backlog.
