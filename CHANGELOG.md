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

- Resolver HTTP routes now reject malformed or non-canonical `did:midnight` inputs with `400 Bad Request` before dispatching resolver or indexer work.
- Resolver `indexerUrl`/`indexerWsUrl` request overrides are now restricted to configured defaults or `MIDNIGHT_INDEXER_ALLOWLIST`.
- Resolver Docker image now runs as the non-root `node` user.
- API/CLI private-state storage now requires `MIDNIGHT_DID_PRIVATE_STATE_PASSWORD` outside standalone `undeployed` runs.
- CLI wallet summaries and test logs redact wallet seeds by default and print only a non-secret fingerprint.
- CI now pins the Compact setup action by SHA and runs a fast contract coverage threshold gate on PRs.

### Fixed

- Delegation state loading now persists normalized verification method ids from fixtures.
- Delegation key rotation now preserves the source grant expiry window for the replacement method.

### Breaking Changes

- Resolver HTTP callers now receive a route-level `400 Bad Request` for malformed `did:midnight` inputs instead of a DID-resolution `200` envelope with `didResolutionMetadata.error = "invalidDid"`. Direct service-layer callers still receive the DID-resolution envelope.
- The contract update model uses individual circuits rather than the previous batched operation-dispatcher shape.
- `@midnight-ntwrk/midnight-did-contract` no longer exports the obsolete `ledger-operation-builder` helper; direct callers should call generated Compact circuits or the API package helpers instead.
- The contract witness private-state type is now exported as `DIDPrivateState`; downstream imports of the previous `MidnightDIDPrivateState` alias must be updated.
- `removeVerificationMethod` no longer cascades relation removal inside the Compact circuit. Direct contract callers must remove authentication/assertion/key-agreement/capability relations first, then remove the verification method. The API helper preserves convenience behavior by issuing relation-removal calls before the method-removal call.
- Ledger-facing verification method and service fields use the compact-compatible `typ` storage field and are mapped back to DID Core `type` at API/resolver boundaries.
- Existing consumers of the previous `Wallet & Resource` provider shape must migrate to `MidnightDIDWalletContext`.
