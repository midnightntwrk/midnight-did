# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Add X25519 and secp256k1 verification method key profiles for canonical
  opaque JWK Midnight DID public key storage.
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
