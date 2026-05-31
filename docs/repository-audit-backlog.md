# Midnight DID Repository Audit Backlog

This backlog tracks DID-core maturity work only. Resolver service, DID manager, and secret-storage backlog items moved to the `midnight-did-resolver` repository with their source code and docs.

## Current Focus

1. Keep `contract`, `domain`, `did`, `api`, and `jubjub-schnorr` package boundaries simple and explicit.
2. Keep root runner targets aligned with the packages still owned by this repository.
3. Keep generated artifacts and local tarball packaging deterministic.
4. Keep the docs site focused on DID method semantics and DID-owned TypeScript packages.
5. Keep sibling VC integration checks accurate after DID package changes.
6. Track production-readiness hardening in
   [`docs/production-readiness-backlog.md`](production-readiness-backlog.md).

## Follow-Up Items

1. Keep `packages/api/src/update.ts` focused on transaction orchestration after
   the 2026-05-21 DID-subject and ledger-mapper split; future work should add
   behavior to those narrower modules instead of re-growing the orchestration
   module.
2. Continue reviewing `packages/api/src/lib.ts`, `providers.ts`, and `wallet.ts`
   for smaller modules without changing public exports.
   - 2026-05-22: `codex/did-api-private-state-provider-boundary` isolates
     DID private-state storage account/password wiring from `providers.ts` and
     adds focused unit tests around the derived provider options.
   - 2026-05-22: `codex/did-wallet-dust-registration-boundary` isolates dust
     registration from wallet build/serialization orchestration and adds unit
     tests around the eligible NIGHT UTXO and wait/register paths.
   - 2026-05-22: `codex/did-wallet-state-boundary` isolates wallet
     snapshot/sync/balance/funding-wait helpers from wallet construction and
     adds focused unit tests around the state helper contract.
   - 2026-05-22: `codex/did-wallet-context-boundary` isolates SDK wallet
     construction and restore context assembly from the public wallet facade.
   - 2026-05-22: `codex/did-wallet-provider-boundary` isolates the wallet
     facade to Midnight wallet/provider adapter from provider composition and
     adds unit tests for public-key exposure, transaction balancing, signing,
     finalization, and submission wiring.
   - 2026-05-22: `codex/did-api-source-import-discipline` normalizes API test
     relative imports to emitted ESM-style specifiers and adds a runner check
     to prevent extensionless API source imports from reappearing.
   - 2026-05-22: `codex/did-package-source-import-discipline` extends that
     guard across DID-owned TypeScript package sources and normalizes remaining
     domain/DID test imports to the same emitted ESM-style specifiers.
   - 2026-05-22: `codex/did-source-import-check-tests` adds a contract test
     for the generalized source-import checker so valid `.js` specifiers and
     invalid extensionless specifiers stay covered in CI.
   - 2026-05-22: `codex/did-workspace-manifest-audit` adds a root workspace
     manifest guard for package names, export maps, tarball `files`, and README
     ownership, plus a fixture-level contract test, so package distribution
     drift is caught in `ci:core`.
   - 2026-05-22: `codex/did-api-lib-options-boundary` moves API runtime
     network endpoint defaults and `setNetworkId()` application into a
     reusable profile catalog while preserving the existing config classes.
   - 2026-05-22: `codex/did-api-network-map-catalog` removes duplicate
     runtime/domain network maps by making `DomainToRuntime`,
     `RuntimeToDomain`, and the legacy `NetworkMapping` export read from one
     checked API catalog.
   - 2026-05-22: `codex/did-api-package-paths` isolates API package-root and
     managed-artifact path resolution from `config.ts`, adds URL-decoding
     coverage for workspaces with spaces in their path, and keeps
     `contractConfig` derivation under focused unit tests.
   - 2026-05-22: `codex/did-api-readonly-network-map` tightens the public API
     network-map contract to `Readonly<Record<...>>`, matching the frozen
     runtime objects used by `DomainToRuntime`, `RuntimeToDomain`, and the
     legacy `NetworkMapping` export.
   - 2026-05-22: `codex/did-api-lazy-provider-adapters` keeps the API barrel
     import lightweight by loading proof/indexer/zk provider adapters only when
     `configureProviders()` is called, with a focused composition test covering
     the runtime adapter handoff.
   - 2026-05-22: `codex/did-api-network-mapping-docs` documents the preferred
     direction-specific network mapping helpers, marks the legacy
     `NetworkMapping` alias as compatibility-only, and records the lazy
     provider-adapter barrel import contract for API consumers.
   - 2026-05-22: `codex/did-api-relation-operations-boundary` moves
     verification-method relation membership checks and relation cleanup out of
     `update.ts`, with focused tests for duplicate/missing relation guards and
     the remove-from-present-relations transaction sequence.
   - 2026-05-22: `codex/did-api-update-operation-modules` keeps `update.ts`
     as the compatibility/public export surface while moving verification
     method, service, document alias/lifecycle, and resolution transaction
     wrappers into small operation modules.
   - 2026-05-22: `codex/did-api-contract-lifecycle-boundary` keeps
     `deploy.ts` as the compatibility/public export surface while moving
     compiled-contract instance wiring, ledger-state reads, private-state
     restore/derive/save logic, and deploy/join/create operations into focused
     modules with private-state lifecycle tests.
   - 2026-05-22: `codex/did-api-deploy-shim-import-discipline` moves internal
     API call sites from the `deploy.ts` compatibility shim to focused
     ledger-state modules and extends the surface-discipline guard so only
     public compatibility barrels/tests import API shims.
   - 2026-05-22: `codex/did-api-public-barrel-direct-exports` moves the public
     API package barrel from `deploy.ts`/`update.ts` compatibility shims to the
     focused implementation modules, shrinking shim import allowlists to only
     compatibility barrels and parity tests.
   - 2026-05-22: `codex/did-api-lib-barrel-parity` adds a focused public
     barrel parity test so every runtime export from `lib.ts` remains available
     through `index.ts` without widening the compatibility-shim allowlist.
   - 2026-05-22: `codex/did-api-index-surface-catalog` adds a package-root
     runtime export catalog test so future API splits cannot silently add,
     remove, or leak runtime exports from `index.ts`.
   - 2026-05-22: `codex/did-lightweight-crypto-boundary` keeps
     `lightweight.ts` as a stateless crypto-helper module, removes its obsolete
     wallet wait/logger coupling, and extends the surface-discipline guard so
     wallet sync/funding behavior stays in `wallet-state.ts`.
   - 2026-05-22: `codex/did-api-default-logger` makes `setLogger()` optional
     for embedders by installing a no-op default logger and covering the
     preconfiguration path with a focused API unit test.
   - 2026-05-22: `codex/did-wallet-sdk-cast-boundary` removes avoidable
     `as any` casts from production wallet SDK integration paths and extends
     the surface-discipline guard so future production API source keeps SDK
     transaction and secret-key types explicit.
   - 2026-05-22: `codex/did-surface-cast-guard-tests` extracts the production
     API cast scan into a tested helper, masks comments/strings before applying
     the guard patterns, and wires the fixture-level test into `ci:core` so the
     no-`as any` policy cannot silently regress.
3. Keep package-level API deploy/update examples compiling against built
   package exports; `run-api.sh` now runs `typecheck:examples`.
   - 2026-05-22: `codex/did-api-prereq-naming` renames the service-era
     `build:service-prereqs` root script to `build:api-prereqs` and extends the
     surface-discipline guard so API runner/build docs stay aligned with the
     repository's DID-core-only scope.
4. Keep generated artifact freshness checks for `contract` and
   `jubjub-schnorr` aligned with Compact source/build-script inputs through
   `pnpm run check:managed-artifacts`.
   - 2026-05-22: `codex/did-managed-artifact-source-manifest` adds
     deterministic SHA-256 source manifests to `artifacts:status` and covers
     the manifest contract with `pnpm run test:managed-artifacts`.
   - 2026-05-22: `codex/did-artifact-status-runner-target` exposes the same
     managed-artifact status and freshness checks through cataloged
     `./run.sh artifact-status` and `./run.sh check-managed-artifacts` targets.
5. Tighten `docs-site` links so moved service pages are referenced only as external repository pointers.
   - 2026-05-22: `codex/did-docs-resolver-boundary-links` adds a docs-site
     repository-boundary guide, links service/runtime mentions to
     `midnight-did-resolver`, and extends the surface-discipline guard so
     deployable resolver/manager/secret-storage wording stays external.
6. Keep `upgrade-libs.sh` aligned with the packages packed by `scripts/pack-artifacts.sh`.
   - 2026-05-22: `codex/did-upgrade-libs-artifact-alignment` moves the DID
     artifact workspace list and destination resolver into a shared shell
     catalog used by both pack and upgrade scripts, adds `--list-packages`, and
     wires a contract test into `ci:core`.
   - 2026-05-22: `codex/did-workspace-catalog-authority` moves root workspace,
     package-manifest, and artifact-tarball package metadata into a shared Node
     catalog consumed by manifest checks and the shell artifact bridge.
7. Continue reducing stale historical docs when they no longer help explain DID
   method evolution.
   - 2026-05-22: `codex/did-archive-stale-transition-docs` moves historical
     develop-transition and ledger-migration notes under `docs/archive/` so the
     top-level docs directory stays focused on current DID-core guidance.
8. Keep root agent guidance aligned with the current CI job names and docs
   layout after the resolver/package split.
   - 2026-05-22: `codex/did-agent-ci-docs-alignment` updates `AGENT.md` to
     use the current API/docs/scan PR job names and docs-site spec paths, then
     extends the surface-discipline guard so service-era CI wording and removed
     `w3c-spec` paths do not come back.
9. Keep sibling VC integration reporting fixture-testable so DID package
   tarball/reference drift can be caught without depending on a developer's
   local checkout layout.
   - 2026-05-22: `codex/did-integration-report-contract` refactors
     `scripts/report-integration.mjs` into an importable report builder, adds
     environment-overridable roots for fixture tests, fails closed on unknown
     CLI arguments, and wires a contract test into `ci:core`.
   - 2026-05-22: `codex/did-integration-report-policy-hardening` makes the
     sibling VC reference policy explicit by classifying dependencies as
     matching file specs, stale file specs, or external specs, and documents
     that missing vendor tarballs are an independent error dimension.
   - 2026-05-22: `codex/did-integration-report-schema-contract` adds a
     versioned integration-report schema descriptor, a `--schema` CLI mode, and
     a report-contract validator so JSON consumers can detect future
     reference-kind or summary-counter shape changes.
   - 2026-05-22: `codex/did-integration-report-schema-runner` exposes that
     schema through the cataloged `./run.sh integration-report-schema` target
     and pins the runner/package-script wiring in the target-catalog contract.
