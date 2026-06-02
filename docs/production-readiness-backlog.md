# Midnight DID Production Readiness Backlog

This backlog captures the production-readiness gaps found during the
2026-05-31 repository/specification/documentation/package review. It is scoped
to `midnight-did`; resolver service, DID manager, secret-storage, VC, examples,
and trust-registry work should stay in their owning repositories.

Status key:

- `Open` - not started.
- `In progress` - actively being changed in a branch or PR.
- `Done` - implemented and verified.
- `Blocked` - depends on an external decision, permission, or upstream release.

## P0 - Release Blockers

| ID | Area | Status | Backlog Item | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| DID-PROD-001 | Docs publishing | Done | Enable GitHub Pages for workflow-based publishing and remove CI-time Pages enablement. | `gh api repos/midnightntwrk/midnight-did/pages` reports `build_type: workflow`; the Docs workflow builds, deploys, and smoke-checks `/`, `/guide/`, `/api/`, and `/spec/midnight-method.html`. |
| DID-PROD-002 | Package release | Open | Define and implement the package release path for DID-owned packages. | Publishable package manifests no longer use `private: true`; package metadata is complete; release CI publishes or dry-runs npm packages with provenance; release notes/changelog move with package versions. |
| DID-PROD-003 | Proof-server trust | Open | Enforce the trusted proof-server operating model at the SDK boundary. | Non-loopback proof-server endpoints fail closed unless the caller explicitly opts into a trusted remote proving mode; README, docs site, and `SECURITY.md` describe the risk and operator requirements. |
| DID-PROD-004 | Controller authorization | Open | Design the untrusted-prover replacement for hash-preimage controller authorization. | A design note or ADR specifies in-circuit verification of wallet-local operation signatures over operation type, DID/contract id, current version or nonce, and all operation inputs. |
| DID-PROD-005 | Security posture | Open | Replace the generic security policy with a Midnight DID threat model and audit plan. | `SECURITY.md` names controller-secret custody, delegated proving, key loss, deactivation finality, audit status, and vulnerability disclosure expectations. |

## P1 - Production Hardening

| ID | Area | Status | Backlog Item | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| DID-PROD-101 | Contract/domain integrity | Open | Close the gap between Compact-side verification method checks and domain JWK validation. | Direct Compact calls cannot create ledger JWK state that the resolver later rejects, or resolver behavior for malformed state is specified and tested. |
| DID-PROD-102 | Key-purpose semantics | Open | Enforce verification relationship compatibility with key type and purpose. | Ed25519/SchnorrJubjub keys cannot be added to `keyAgreement`; X25519 keys cannot be added to signing/authentication relations unless explicitly documented as supported. |
| DID-PROD-103 | API transaction semantics | Open | Make verification-method removal semantics explicit and resilient. | Default removal fails when the method is referenced, or purge-then-remove is exposed as an explicit advanced operation with recovery/idempotency guidance. |
| DID-PROD-104 | Timestamps | Open | Make DID ledger timestamps monotonic and clearly scoped. | Contract updates cannot move `updated` backwards; spec and docs state whether timestamps are ledger-bound or controller-provided advisory metadata. |
| DID-PROD-105 | Recovery model | Open | Decide the production recovery story for lost controller secrets. | Spec and docs clearly state no recovery, or the contract/API supports a precommitted recovery/multicontroller mechanism with tests. |
| DID-PROD-106 | Examples | Open | Stop presenting plaintext secret export as a normal bootstrap path. | Bootstrap examples are renamed or flagged as dev-only, or encrypt/export secrets through an explicit custody mechanism. |
| DID-PROD-107 | API documentation | Open | Publish production-consumable API docs. | Public docs include install/acquisition steps, imports, signatures, return values, failure modes, network profile examples, and proof-server trust notes for primary operations. |
| DID-PROD-108 | Integration documentation | Open | Add an end-to-end integration map across DID, resolver, VC, and trust registry. | Docs include repo/package version boundaries, deployment responsibilities, API contracts, and known limitations. |
| DID-PROD-109 | Multikey verification methods | Open | Decide and implement `Multikey` / `publicKeyMultibase` support for W3C Data Integrity and BBS-oriented suites. | Spec names supported multibase/multicodec profiles; contract/API store Multikey methods through an explicit representation rather than overloading `publicKeyJwk`; resolver emits conforming DID Documents and rejects methods containing both `publicKeyJwk` and `publicKeyMultibase`. |

## P2 - Supply Chain And Operational Readiness

| ID | Area | Status | Backlog Item | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| DID-PROD-201 | Package contents | Open | Ensure packed artifacts contain only production package surfaces. | Tarballs exclude compiled tests, fixtures, and repo-local examples unless intentionally documented; CI asserts package contents. |
| DID-PROD-202 | Package smoke tests | Open | Test consumer installs from packed tarballs, not workspace symlinks only. | CI creates tarballs, installs them into a clean temp consumer, and imports Node/browser entry points from package exports. |
| DID-PROD-203 | Dependency hygiene | Open | Re-enable dependency update and audit visibility without blocking unrelated development on known dev-only items. | npm Dependabot is active; production dependency audit is gated; dev/tooling advisories are tracked with owners and upgrade notes. |
| DID-PROD-204 | Crypto dependency policy | Open | Pin crypto-adjacent runtime dependencies exactly. | Publishable packages reject caret/tilde ranges for `dependencies` that affect key generation, signing, hashing, validation, or serialization. |
| DID-PROD-205 | Contract versioning | Open | Define what `contractVersion` means for deployed DIDs. | Spec either removes upgrade implications or documents resolver/migration behavior for future contract versions. |
| DID-PROD-206 | Cost model | Open | Document the per-DID contract deployment model. | Spec/docs explain deployment cost, indexer load, and operational implications of one DID per contract. |
| DID-PROD-207 | Mainnet profile | Open | Avoid implying mainnet readiness before the network and endpoints are available. | The mainnet profile fails with an explicit unavailable message or is gated behind a documented launch flag. |
| DID-PROD-208 | Ownership | Open | Add code ownership for crypto- and contract-critical paths. | `CODEOWNERS` requires suitable review for `packages/contract`, `packages/jubjub-schnorr`, controller operations, and key serialization code. |

## P3 - Cleanup

| ID | Area | Status | Backlog Item | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| DID-PROD-301 | Test maintainability | Open | Split the large DID contract test file into smaller circuit-focused suites. | Tests remain equivalent but are grouped by lifecycle, verification methods, relations, services, and SchnorrJubjub verification. |
| DID-PROD-302 | Backlog hygiene | Open | Archive completed historical audit notes that no longer guide current work. | `docs/repository-audit-backlog.md` keeps only active audit themes and links to archived completed entries. |
| DID-PROD-303 | Nix docs | Open | Document the repo-local Nix flake in standalone development docs. | README or local-development docs include the flake entry point and how it relates to the workspace shell. |
