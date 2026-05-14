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

14. ✅ **Done: Create structured spec-to-implementation matrix**
   - Add `docs/midnight-did-spec-matrix.yaml` (or `.json`) linking every use case section to implementation status, risk, and owner.
  - Acceptance: reviewers can verify status in one file before writing or merging PRs.

15. ✅ **Done: Add canonical compact VC schema package**
   - Introduce agreed credential type definitions for identity, role, and compliance flows.
   - Accepted: shared schema module now exists at `schemas/compact-vc` with:
     - shared schema registry and envelope helpers
     - 3 canonical credential fixtures (identity/role/compliance)
     - deterministic SHA-256 vector fixtures
     - `npm run test:vc-profile` execution check.

16. ✅ **Done: Add VC status/reference baseline**
   - Added soft-status verifier helpers in `api/src/vc-status.ts`:
     - `evaluateVcStatus`
     - `assertVcNotRevoked`
     - `VcRevocationError`
     - `loadVcStatusRegistryFromFile`
     - `statusRegistryFixturePath`
   - Added fixture format under `api/src/test/fixtures/vc-status/*.json` with active and revoked snapshots for the same credential entry.
   - Added verifier-level test in `api/src/test/vc-status-verification.test.ts`.
   - Acceptance: same credential in revoked state is rejected by verifier test (`VcRevocationError`).

17. ✅ **Done: Add issuer/verifier trust registry contract scaffold**
   - Added `api/src/trust-registry.ts` with role lifecycle primitives:
     - `applyTrustRoleTransition`
     - `evaluateTrustRole`
     - `assertTrustRoleActive`
     - `getTrustRoleHistory`
     - `loadTrustRegistryFromFile`
     - `trustRegistryFixturePath`
   - Added fixture snapshot at `api/src/test/fixtures/trust-registry/trust-registry-baseline.json` with issuer and verifier seed roles.
   - Added transition tests in `api/src/test/trust-registry-contract.test.ts` covering:
     - issuer grant -> expiry-based inactivity
     - verifier grant -> revoke transition + ordered history
     - inactive role assertion failure path
   - Acceptance: two role-specific transitions are now covered by contract-style tests, including role-history visibility.

18. ✅ **Done: Add DID role delegation + capability template**
   - Added `api/src/did-delegation.ts` with:
     - template validation and normalized verification-method handling
     - grant/revoke/rotate transition evaluator
     - active-delegation decision API and history inspection
     - key rotation helper and fixture loading utilities
   - Added deterministic fixtures under `api/src/test/fixtures/delegation/`:
     - `delegation-template-agent.json`
     - `delegation-template-service.json`
     - `delegation-baseline-state.json`
   - Added contract-style tests in `api/src/test/did-delegation-contract.test.ts` covering:
     - template validation, grant materialization, key rotation, revoke path, and ordered history
   - Acceptance: delegated key rotation and revoke path validated by tests; agent/service template artifacts exist and are loadable.

19. **Add university-style presentation/issuance BDD slices**
   - Create deterministic fixtures and scenario flow for student-issued diploma, verifier checks, and rejection path.
   - Acceptance: scenario validates request/response/decision logs and exports timing artifacts.

20. ✅ **Done: Add PR-ready governance for stackable review**
   - Add a short PR template and review checklist for use-case-related changes.
   - Acceptance: checklists require matrix link, scenario coverage, and status update in the backlog.
