# WebAuthn / ES256 (P-256) support: Implementation plan

## Goal
Enable `did:midnight` to register and resolve WebAuthn-compatible verification
methods using ES256 (P-256 / secp256r1) JWKs, so offline signing flows can use
passkeys while the DID remains the authoritative on-chain anchor for DID state.

## Inputs and references
- Issue: https://github.com/midnightntwrk/midnight-did/issues/32
- Discussion: https://github.com/midnightntwrk/midnight-did/discussions/23
- Prior research: `feature/webauthn` branch `research/webauthn-integration.md`

## Scope
- Add P-256 (secp256r1 / ES256) as a supported curve where JWK verification
  methods are accepted.
- Update contract schema, domain model, DID translators, and tests.
- Extend CLI/API surfaces to accept P-256 JWKs.
- Update documentation to reflect new DID traits and WebAuthn guidance.

## Non-goals (initial delivery)
- Full WebAuthn backend endpoints, credential storage, or attestation policies.
- Browser-side WebAuthn UX flows or SDK integration.
- ZK circuits for WebAuthn signature verification.

## Constraints and assumptions
- Compact `Field` limits support P-256 coordinates (verify against runtime).
- ES256 keys are represented as JWK `kty: "EC", crv: "P-256"`.
- DID operations remain authorized by the controller key; WebAuthn is used for
  offline signing and authentication outside the ledger.

## Milestones
1) Schema + contract support for P-256
2) End-to-end DID serialization + validation with ES256 keys
3) CLI/API support and documentation updates
4) Release + verification on target networks

## Implementation plan

### 1) Schema and enum extensions
- Add new curve to domain model:
  - `packages/domain/src/did-document.ts`: extend `CurveType` enum with `P256` (or
    `Secp256r1`) and allow `KeyType.EC` with `P-256`.
  - Update `PublicKeyJwkSchema` validation so EC keys accept `P-256` and require
    `x`/`y` coordinates.
- Add new curve to DID contract schema:
  - `packages/contract/src/did.compact`: extend `CurveType` enum.
  - Regenerate bindings if needed and update any ABI references.

### 2) Translators and operation builders
Update enum mappings and conversions:
- `packages/did/src/domain-to-ledger.ts`: map new curve to ledger enum.
- `packages/did/src/ledger-to-domain.ts`: map ledger enum back to `P-256`.
- `packages/contract/src/ledger-operation-builder.ts`: allow building operations with
  EC + P-256 keys.

### 3) Tests and fixtures
- Add new fixtures with ES256 JWKs:
  - `packages/domain/src/test/fixtures/did.ts`
  - `packages/contract/src/test/fixtures/simulator.ts`
- Expand tests to accept P-256:
  - `packages/domain/src/test/did-document.verification-method.test.ts`
  - `packages/did/src/test/midnight-did-document.test.ts`
  - `packages/did/src/test/domain-to-ledger.unit.test.ts`
  - `packages/did/src/test/ledger-to-domain.unit.test.ts`
  - `packages/api/src/test/did.api.test.ts` (if API validates curve)

### 4) CLI and API surface changes
- CLI: allow `P-256` in verification method JWK inputs.
  - `cli/src/cli.ts` parsing/validation as needed.
- API: ensure request validation accepts P-256 in JWK payloads.
  - `packages/api/src/...` any schema validators or request handlers.

### 5) Documentation updates
- Update DID traits docs and method spec to advertise
  `cryptographicAlgorithmECDSAsecp256r1: true`.
- Add a short guide for WebAuthn key mapping:
  - COSE -> JWK mapping notes, `kty: "EC"`, `crv: "P-256"`, base64url for
    `x`/`y`, and DID fragment conventions.

### 6) Release and migration
- Bump contract version and publish updated contract package.
- Update downstream packages that pin contract ABI/enum values.
- Provide migration notes for existing deployments and resolvers.

## Acceptance criteria
- DID validation accepts ES256 JWKs (EC + P-256) across domain, contract, and
  DID resolution layers.
- Ledger operations serialize and deserialize P-256 keys without loss.
- Updated tests demonstrate add/update/remove operations with P-256 keys.
- Documentation reflects new curve support and DID traits.

## Open questions
- Preferred enum name: `P-256` vs `Secp256r1` in code and ABI.
- Compact runtime limits for coordinate sizes and signature primitives.
- Whether to include `cryptographicAlgorithmECDSAsecp256r1` in a formal DID
  Traits JSON artifact in this repo.

## Optional follow-ups (separate deliverables)
- WebAuthn controller service endpoints and credential lifecycle APIs.
- Attestation policy and metadata storage via DID service endpoints.
- Sample relying party flow using DID-resolved WebAuthn keys.
