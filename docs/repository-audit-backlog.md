# Midnight DID Repository Audit Backlog

This backlog tracks DID-core maturity work only. Resolver service, DID manager, and secret-storage backlog items moved to the `midnight-did-resolver` repository with their source code and docs.

## Current Focus

1. Keep `contract`, `domain`, `did`, `api`, and `jubjub-schnorr` package boundaries simple and explicit.
2. Keep root runner targets aligned with the packages still owned by this repository.
3. Keep generated artifacts and local tarball packaging deterministic.
4. Keep the docs site focused on DID method semantics and DID-owned TypeScript packages.
5. Keep sibling VC integration checks accurate after DID package changes.

## Follow-Up Items

1. Review `packages/api/src/lib.ts` for smaller provider/wallet modules without changing public exports.
2. Add package-level examples for API deploy/update flows that do not depend on service UI code.
3. Audit generated artifact freshness checks for `contract` and `jubjub-schnorr`.
4. Tighten `docs-site` links so moved service pages are referenced only as external repository pointers.
5. Keep `upgrade-libs.sh` aligned with the packages packed by `scripts/pack-artifacts.sh`.
6. Continue reducing stale historical docs when they no longer help explain DID method evolution.
