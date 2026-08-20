# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- BREAKING: Make verification-method deletion a single explicit operation.
  `removeVerificationMethod` and `removeSchnorrJubjubVerificationMethod` no
  longer purge DID verification relationships implicitly; callers must remove
  selected relationships explicitly and now receive the typed
  `VerificationMethodReferencedError` while references remain.
- Preserve pending controller private state whenever controller rotation or
  recovery does not return finalized transaction data. One process-local,
  per-bound-contract critical section now begins before provider-dependent
  private-state and ledger preflight and covers persistence, authorization,
  transaction-call attempt, promotion, and cleanup across provider wrappers.
  Typed exists, busy, and unavailable errors prevent overlapping reconciliation
  from overwriting, promoting, or removing another operation's candidate.
  Confirmed non-finalization permits discard of any non-null pending record,
  including malformed state; promotion still requires valid pending state.
  Cleanup rejection after successful promotion warns that the pending record may
  remain or may already have been removed; later reconciliation processes
  retained state or returns the typed unavailable error if deletion committed.
  Controller operations reject known provider/DID binding mismatches before any
  provider or ledger access, and deployment holds a source/target address lease
  through active-state persistence. Separate processes and independently unbound wrappers require
  an external per-DID lock because the provider API offers no cross-process CAS.
- Preserve complete canonical DID URL identity for verification methods,
  relationships, and services while keeping existing current-subject
  fragment-keyed ledger records operable through fail-closed state-aware key
  selection. Canonical and legacy keys for one logical identity are rejected as
  ambiguous.
- Add a provider-aware `verifySchnorrJubjubDigestSignature` overload that
  selects the sole existing canonical or compatible legacy physical ledger key;
  retain the historical fragment-keyed signature as a deprecated compatibility
  overload.
- Restore DID Core service endpoint set validation: each endpoint array must be
  non-empty and unique after URI and structural normalization.
- Upgrade the Compact toolchain from 0.30.0 to 0.31.1, now consumed from the
  external `MediaNoxLabs/flake-collection` flake input instead of the vendored
  `nix/packages/compact-toolchain.nix` derivation. Relax the
  `jubjub-schnorr.compact` language-version pragma from an exact `0.22` pin to
  `>= 0.22`.
- Expose `MidnightDidApiError<Code>` as the common constructor-owned coded-error
  base used by ZK artifact, referenced-verification-method, and pending-controller
  errors while preserving their specific classes and stable domain codes.

### Removed

- Drop the `align-runtime-version.mjs` post-build workaround scripts from the
  `contract` and `jubjub-schnorr` packages; `compactc` 0.31.1 emits a
  `checkRuntimeVersion` guard that matches the installed runtime natively, so
  no rewriting is required. As a packaging-visible consequence, the published
  `@midnight-ntwrk/midnight-did-jubjub-schnorr` `.d.ts` no longer carries the
  invalid duplicate `provableCircuits` declaration the rewrite previously
  injected.
- BREAKING: DID Document constructors omit absent optional members and DID
  Document parsers reject explicit JSON `null` for optional properties instead
  of accepting or emitting null-valued fields.
  Consumers persisting documents from versions up to 0.5.0 must omit legacy
  null-valued optional members before parsing them with this release.


## [0.5.0] - 2026-08-03

### Added

- Add X25519 and secp256k1 verification method key profiles for canonical
  opaque JWK Midnight DID public key storage.
- Add BLS12381G1 and BLS12381G2 OKP JWK profiles for compressed BLS12-381
  public keys stored as opaque canonical `publicKeyJwk.x` strings.
- Add controller key rotation with SDK-local controller public key derivation
  and wallet-persisted random controller secrets.
- Add DID surface-change discipline documentation and an automated guard for
  package exports, artifact packaging, workflow branch targeting, and PR review
  checklist drift.

### Changed

- BREAKING: Limit the DID contract's exported circuits to a compact DID CRUD
  set/toggle surface plus one ledger-bound SchnorrJubjub verification circuit.
  Controller key derivation is now an internal helper, and reusable Jubjub
  sign/verify/challenge helpers remain in the dedicated `jubjub-schnorr`
  package instead of caller-supplied-key DID contract circuits.
- BREAKING: Store ledger `PublicKeyJwk.x` and `PublicKeyJwk.y` as
  `Opaque<"string">` canonical unpadded base64url values instead of Compact
  field/byte coordinate encodings, preserving arbitrary 32-byte JWK key material
  losslessly without Compact field bounds. Replace field-element placeholder
  encodings such as `encodeFieldElement(v)` with canonical unpadded base64url
  strings that decode to exactly 32 bytes. OKP keys store an empty `y` sentinel
  on ledger and omit `y` in DID Document output.
- BREAKING: Reassign ledger `CurveType` integer tags while defining the
  prototype key profile set: `Jubjub` moves from `1` to `2`, `P256` from `2` to
  `3`, with `X25519=1` and `Secp256k1=4`.
- BREAKING: Replace boolean Compact mutation flags with explicit
  `MapMutation.Insert` / `MapMutation.Update` and
  `SetMutation.Insert` / `SetMutation.Remove` enum values.
- Generate DID controller private state from wallet randomness instead of
  deriving it from a circuit prover key.
- BREAKING: Define the prototype offchain Midnight DID portable form as
  `did:midnight:offchain:<persistent-hash-of-state>:<encoded-state>`,
  replacing the earlier `?state=` DID URL helper surface.
- Migrate the workspace package manager from npm to pnpm 10, including
  `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `workspace:*` internal package
  dependencies, and exact Midnight runtime dependency pins.
- Align `pnpm run ci`, README guidance, and the PR template around
  `./run.sh --light --strict` as the local PR validation contract.
- Make `scripts/clean-artifacts.mjs` self-documenting and fail safely when an
  unknown cleanup flag is provided.
- Extend artifact cleanup to nested generated `logs/` directories and prune
  stale local-development surfaces that no longer match the `packages/` layout.
- Include explicit package `files` manifests for the `domain` and `did`
  library packages so local tarballs expose the intended runtime surface only.

### Removed

- Move resolver service, DID manager service, and reusable secret-storage
  workspaces out of this repository. Their package and service surfaces now
  live in the `midnight-did-resolver` repository.
