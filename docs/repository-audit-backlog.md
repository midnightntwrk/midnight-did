# Midnight DID Repository Audit Backlog

Status: current simplification and maintenance backlog for `origin/develop`.
Last audited: 2026-05-20.

This document is the DID repository execution queue for work that improves
simplicity, maintainability, documentation accuracy, runner ergonomics, package
boundaries, and human-readability. It deliberately excludes VC, Passport,
university, mall, and product-specific flows; those belong in sibling repos.

## Current Baseline

The `develop` branch already contains the first runner simplification wave:

- `./run.sh targets`
- `./run.sh clean-artifacts`
- `./run.sh integration-report`
- `./run.sh check-integration`
- `npm run check:run-target-catalog`
- safe generated-artifact cleanup script
- DID-to-VC integration readiness report

Open DID manager stack not yet on `develop` at audit time:

- `#96` `fix(manager): initialize preprod network before unlock validation`
- `#97` `feat(manager): expose wallet sync diagnostics`

Future work below should start from `origin/develop` unless it directly extends
one of those manager PRs.

## Audit Findings

### Strengths

- DID package boundaries are now first-class workspaces.
- Runner help is discoverable and has a checked target catalog.
- Generated artifacts, local databases, docs-site output, Playwright reports,
  and package tarballs are ignored.
- DID/VC repository ownership is mostly documented in `AGENT.md` and README.
- The DID manager is now clearly scoped to DID CRUD, keys, sessions, and raw DID
  document inspection.

### Remaining Gaps

- Local validation and CI validation are still not one obvious contract.
- `./run.sh` only exposes a coarse `full` target plus meta targets; core, API,
  resolver, manager, and docs remain separate shell scripts.
- Root `package.json`, runner scripts, package prerequisites, and packable
  package lists still duplicate workspace topology.
- Package manifest policy does not yet distinguish publishable libraries from
  services and docs packages in an executable way.
- Several docs still explain sibling repo operational behavior instead of
  linking to the owning repo.
- DID manager UI and service orchestration are readable but large enough that
  future edits are risky.

## Top 20 Simplification Backlog Items

1. `validation-contract-alignment`
   - make one authoritative local PR command clear, likely
     `./run.sh --light --strict`
   - either align `npm run ci` with that command or rename/document it as a
     package-only lane
   - verify README, PR template, package scripts, and workflows agree

2. `runner-target-expansion`
   - extend the runner catalog so `./run.sh core|api|resolver|manager|docs|full`
     are real targets
   - keep `run-core.sh`, `run-api.sh`, `run-resolver.sh`, and `run-manager.sh` as
     thin implementation details or remove them after migration

3. `workspace-topology-catalog`
   - centralize workspace groups, service packages, packable libraries,
     prerequisite profiles, and test lanes in one executable catalog
   - make root scripts and runner checks validate against that catalog

4. `package-manifest-audit`
   - enforce local workspace dependency specs and package class policy
   - fix local dependency drift such as manager dependencies that look published
     instead of workspace-local

5. `packable-library-reporting`
   - update integration reporting so publishable DID libraries, local services,
     and docs-only packages are reported separately
   - keep artifact packaging and integration report package classes consistent

6. `dependency-boundary-constraints`
   - replace ad hoc dependency checks with one package dependency matrix
   - cover `contract`, `jubjub-schnorr`, `domain`, `did`, `api`,
     `secret-storage`, resolver service, manager service, and docs site

7. `shared-ts-eslint-configs`
   - consolidate repeated TypeScript and ESLint configuration
   - keep only package-specific overrides where dependency/runtime constraints
     require them

8. `compact-toolchain-doc-clarity`
   - reconcile Nix compiler package wording with `compact update 0.30.0`
     guidance
   - explain runtime/compiler guard versions without implying a conflicting setup

9. `did-only-doc-scope-cleanup`
   - remove Passport/product operational steps from DID docs
   - link to workspace, VC, or examples repos for sibling workflow details

10. `docs-source-drift-check`
   - prove docs-site source/API reference generation is deterministic without
     committing generated output
   - document authored docs versus synced/generated docs-site content

11. `manager-browser-script-modules`
   - split the large manager UI script into smaller typed modules or generated
     script fragments
   - start with API client, state/render helpers, validation helpers, and page
     controllers

12. `manager-service-module-split`
   - split `DidManagerService` orchestration by concern: wallet lifecycle, DID
     lifecycle, contract selection, signatures, profile/session persistence

13. `manager-route-registry`
   - co-locate route method/path/schema/handler metadata
   - use it to generate route summaries and reduce manual Fastify route drift

14. `pass-with-no-tests-policy`
   - remove broad `--passWithNoTests` usage where packages should always have
     tests
   - document intentional exceptions and guard them

15. `fast-full-coverage-policy`
   - make fast/full runtime-test and coverage expectations explicit
   - avoid confusing CI job names that imply coverage when coverage is not run

16. `manifest-driven-clean-artifacts`
   - make cleanup allowlist-driven by workspace and artifact type
   - keep `--dry-run` useful and avoid broad name-only deletion surprises

17. `github-actions-setup-consolidation`
   - reduce repeated checkout/Node/Compact/npm setup in CI/docs workflows through
     a reusable action or workflow

18. `onchain-runtime-shim-exit-plan`
   - keep the node_modules shim version-guarded and documented
   - track the upstream removal condition and make failures actionable

19. `core-large-file-decomposition`
   - decompose large files by concern, starting with `api/src/lib.ts`,
     `domain/src/offchain-midnight.ts`, and `did/src/ledger-to-domain.ts`
   - preserve public exports and add targeted tests before moving logic

20. `docs-link-and-command-reference-check`
   - add a fast docs link and command-reference checker
   - validate referenced `run.sh` targets, package scripts, and docs-site commands

## First 10 PR Slices

These are ordered for stackable execution. Keep active stack depth shallow: if a
base PR goes red, repair it before continuing downstream work.

1. `did-validation-contract-alignment`
   - covers backlog items 1, 2, and README/PR-template updates
   - validation: `npm run check:run-target-catalog`, `npm run test:run-sh`,
     `./run.sh targets`, `./run.sh --light --strict`

2. `did-package-manifest-audit`
   - covers items 3, 4, and 5
   - validation: manifest audit, `npm run artifacts:pack`,
     `./run.sh integration-report`, `./run.sh check-integration`

3. `did-docs-scope-and-toolchain-cleanup`
   - covers items 8, 9, and 10
   - validation: `npm run docs:sync-source`, `npm run docs:build`,
     `git diff --check`

4. `did-dependency-boundary-constraints`
   - covers item 6 and makes package dependency direction executable
   - validation: dependency matrix check plus `./run.sh --light --strict`

5. `did-shared-configs`
   - covers item 7 with minimal config churn
   - validation: `npm run lint`, `npm run typecheck:all`

6. `did-clean-artifacts-manifest`
   - covers item 16 and documents cleanup safety
   - validation: `npm run clean:artifacts -- --dry-run --json`,
     `./run.sh clean-artifacts`, `git status --ignored --short`

7. `did-ci-setup-consolidation`
   - covers item 17
   - validation: workflow lint by inspection, existing CI checks on PR

8. `did-manager-ui-modules`
   - covers item 11
   - validation: manager lint/build/tests and Playwright if UI behavior changes

9. `did-manager-service-modules`
   - covers items 12 and 13
   - validation: manager unit tests, focused API route tests, `./run.sh --light`

10. `did-core-large-file-split`
   - covers item 19, starting with the least risky module
   - validation: package-specific tests plus `./run.sh --light --strict`

Items deferred beyond the first 10 slices: `pass-with-no-tests-policy`,
`fast-full-coverage-policy`, `onchain-runtime-shim-exit-plan`, and
`docs-link-and-command-reference-check`. They are still active backlog items, but
they are safer after runner, package, docs, cleanup, CI, and manager-module
foundations are in place.

## Validation Defaults

Fast docs/backlog slice:

```bash
git diff --check
npm run check:did-surface-discipline
npm run check:run-target-catalog
./run.sh targets
```

Fast code slice:

```bash
git diff --check
./run.sh --light --strict
```

Package/integration slice:

```bash
npm run artifacts:pack
./run.sh integration-report
./run.sh check-integration
```

Docs-site slice:

```bash
npm run docs:sync-source
npm run docs:build
```

## Do Not Touch Without Explicit Scope

- `NightFi` and `arc-passport` from the identity workspace
- generated `src/managed/**`, `dist/**`, docs-site generated source, reports,
  and API reference output
- sensitive DID manager local state under `~/.midnight-did`
- Compact contract semantics or JubJub Schnorr transcript logic as part of a
  cleanup PR
- VC, Passport, university, mall, or student flows inside this DID repository
