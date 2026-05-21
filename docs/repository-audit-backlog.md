# Midnight DID Repository Audit Backlog

This backlog tracks DID-core maturity work only. Resolver service, DID manager, and secret-storage backlog items moved to the `midnight-did-resolver` repository with their source code and docs.

## Current Focus

1. Keep `contract`, `domain`, `did`, `api`, and `jubjub-schnorr` package boundaries simple and explicit.
2. Keep root runner targets aligned with the packages still owned by this repository.
3. Keep generated artifacts and local tarball packaging deterministic.
4. Keep the docs site focused on DID method semantics and DID-owned TypeScript packages.
5. Keep sibling VC integration checks accurate after DID package changes.

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
3. Keep package-level API deploy/update examples compiling against built
   package exports; `run-api.sh` now runs `typecheck:examples`.
4. Keep generated artifact freshness checks for `contract` and
   `jubjub-schnorr` aligned with Compact source/build-script inputs through
   `npm run check:managed-artifacts`.
5. Tighten `docs-site` links so moved service pages are referenced only as external repository pointers.
6. Keep `upgrade-libs.sh` aligned with the packages packed by `scripts/pack-artifacts.sh`.
7. Continue reducing stale historical docs when they no longer help explain DID method evolution.
