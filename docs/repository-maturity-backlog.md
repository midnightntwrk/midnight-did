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

4. **Fail-fast API/CLI dependencies check in dev environment**
   - Add a local precheck for known workspace dependency/type drift before `run.sh` starts so failures are easier to triage.

5. ✅ **Done: Formalize workspace contract for each package**
   - `scripts/repository-audit.mjs` now enforces required workspace scripts `lint`, `build`, `test`, `coverage`, and `lint:fix`.
   - Added `cli` `test` script alias (`npm run test-api`) so all workspaces satisfy the contract.

6. **Add deterministic timing artifact export**
   - Add `--metrics-json <path>` option to `run.sh` and publish artifacts in CI for trend analysis.

7. ✅ **Done: Introduce a root-level `npx`/`npm` sanity task**
   - Added `npm run check:toolchain` with root precheck logic in `scripts/check-toolchain.mjs`.
   - `run.sh` executes this precheck before patching and heavy pipeline work.
   - Added in [`scripts/check-toolchain.mjs`](/Users/ysh/iohk/midnight-did/scripts/check-toolchain.mjs) and wired via `run.sh` (`node scripts/check-toolchain.mjs`).

8. **Tighten CI smoke targets**
   - Add a minimal workflow job that runs only `npm run check:boundaries` + `npm run run:fast` to catch most breakage in < 10 minutes.

9. **Unify documentation and script discoverability**
   - Add a small contributor section in `CONTRIBUTING.md` listing canonical scripts and recommended local workflow by role (issue triage, feature, release).

10. **Backlog-driven cross-repo review loop**
    - After each PR, run manual or assistant review pass and update this backlog with blocked/investigated items.
    - This should include a short post-PR note on stale/legacy directories touched or newly introduced.
