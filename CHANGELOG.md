# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- University BDD transport/reporting tooling with simulator artifacts and PR summary helpers.
- Resolver service package for resolving `did:midnight` identifiers over HTTP.
- Delegation, trust-registry, and VC status helper modules in the API workspace.
- CI precheck for Compact compiler/runtime compatibility.

### Changed

- Migrated the Midnight SDK dependency stack to the v8-compatible toolchain.
- Updated resolver/API defaults from indexer GraphQL `/api/v1/graphql` to `/api/v3/graphql`.
- Changed API provider setup around `configureProviders()` and wallet context handling for Midnight.js v4.

### Security

- Resolver `indexerUrl`/`indexerWsUrl` request overrides are now restricted to configured defaults or `MIDNIGHT_INDEXER_ALLOWLIST`.
- Resolver Docker image now runs as the non-root `node` user.
- CI now pins the Compact setup action by SHA and runs a fast contract coverage threshold gate on PRs.

### Breaking Changes

- The contract update model uses individual circuits rather than the previous batched operation-dispatcher shape.
- Ledger-facing verification method and service fields use the compact-compatible `typ` storage field and are mapped back to DID Core `type` at API/resolver boundaries.
- Existing consumers of the previous `Wallet & Resource` provider shape must migrate to `MidnightDIDWalletContext`.
