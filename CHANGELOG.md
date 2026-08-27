# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - Unreleased

All breaking changes below are assigned to the upcoming 0.6.0 release; the
published 0.5.0 packages retain their existing API and behavior.

### Changed

- Refresh the DID Core 1.0, DID Core 1.1, and DID Resolution evidence matrices
  for the post-#434 0.6 baseline and add `pnpm test:conformance` for the focused
  repository-owned reproduction lane. The 0.6 conformance claim is bounded to
  DID Core 1.0; the DID Core 1.1 and 2026 DID Resolution CR audits now disclose
  the incompatible context/media types, resolver signature and split helpers,
  keyword errors, and readable deactivated documents as failures rather than
  passing representation evidence. The coordinated breaking migration remains
  outside 0.6 under #447. Add semantic DID JSON/JSON-LD evidence for the 1.0-era
  profile and resolver-level deactivation metadata coverage. The published DID
  resolver runtime now follows RFC 9110 exact, type-wildcard, and global-wildcard
  precedence for its retained 0.6 media types, honors exact `q=0` exclusions,
  enforces strict quality-value syntax (including rejection of `.5`), treats
  every non-`q` parameter as a required `name=value` media-range parameter even
  after the weight, and rejects malformed-only ranges before ledger reads while
  retaining valid ranges from mixed malformed/valid input. This hardening does
  not broaden media
  support. Document that `contractVersion` is a
  schema/compatibility discriminator rather than an upgrade guarantee, that CMA
  signing keys require separate export and custody, that 0.6 has no generic
  in-place migration system, and that configured indexer reads are trusted
  without light-client, independent state-proof, or finality verification.
- BREAKING: Make verification-method deletion a single explicit operation.
  `removeVerificationMethod` and `removeSchnorrJubjubVerificationMethod` no
  longer purge DID verification relationships implicitly; callers must remove
  selected relationships explicitly and now receive the typed
  `VerificationMethodReferencedError` while references remain.
- Preserve pending controller private state whenever a controller rotation or
  recovery transaction call is attempted but does not return finalized data.
  Failures definitely before `callTx` invocation attempt to remove the newly
  persisted candidate inside the held lease; a rejected cleanup warns that the
  record may remain or may already have been removed and retains explicit
  discard guidance. One process-local, per-bound-contract critical section now
  begins before provider-dependent
  private-state and ledger preflight and covers persistence, authorization,
  transaction-call attempt, promotion, and cleanup across provider wrappers.
  Typed exists, busy, and unavailable errors prevent overlapping reconciliation
  from overwriting, promoting, or removing another operation's candidate.
  Confirmed non-finalization permits discard of any non-null pending record,
  including malformed state; promotion still requires valid pending state.
  Cleanup rejection after successful promotion warns that the pending record may
  remain or may already have been removed; later reconciliation processes
  retained state or returns the typed unavailable error if deletion committed.
  After an ambiguous call, applications wait for connectivity and trusted
  finalized ledger state, promote when the retained secret derives the finalized
  current controller key, and discard only after authoritative non-finalization.
  Controller operations reject known provider/DID binding mismatches before any
  provider or ledger access. Deployment holds a source/target address lease
  through active-state persistence, and join now holds the same owner-token
  lease across source/target binding, private-state read, and deployed-contract
  lookup. Reservation is fail-fast and remains owned until the operation is
  cancelled and settles, otherwise terminates or settles, or the process exits.
  There is deliberately no lease expiry: releasing a reservation while stale
  provider or transaction work can still complete could let an old owner
  overwrite, promote, or remove another operation's state. The supported
  baseline assumes one application writer process per DID. Multiple writer
  processes require a distributed lock or equivalent fencing mechanism; direct
  provider mutation and independently unbound wrappers remain outside the API
  guarantee. The provider's unbound-state exception is recognized only by its
  exact upstream message; decorated I/O or other provider failures propagate.
- Intercept the post-ledger-success provider setup performed inside
  `@midnight-ntwrk/midnight-js-contracts` 4.0.2 `deployContract`: synchronously
  reserve and bind the canonical target under the deployment's source lease,
  then let the dependency persist active state and its signing key exactly once.
  Target-reservation, either persistence, or returned-handle construction
  failure is reported as
  `DIDContractDeploymentFinalizedPrivateStateIncompleteError` with only stable
  code/name, canonical address, and a controlled target-reservation,
  private-state-persistence, signing-key-persistence, or
  contract-handle-construction stage. Source errors,
  contract handles, deployment/transaction/finality objects, and arbitrary
  provider text are discarded rather than attached or shallow-copied. Pre-target
  failures remain unchanged, and the operation-scoped lease has no unsafe
  elapsed expiry or post-settlement proxy reuse.
- Preserve complete canonical DID URL identity for verification methods,
  relationships, and services while keeping existing current-subject
  fragment-keyed ledger records operable through fail-closed state-aware key
  selection. Canonical and legacy keys for one logical identity are rejected as
  ambiguous.
- Add a provider-aware `verifySchnorrJubjubDigestSignature` overload that
  selects the sole existing canonical or compatible legacy physical ledger key;
  the deprecated four-argument overload now uses the same fail-closed lookup
  for API-created contract handles while retaining its documented fragment
  fallback for unregistered handles.
- Restore read compatibility for historical path and dot-relative verification
  method ids without fragments, canonicalizing them to subject-bound absolute
  DID URLs without admitting unrelated query-only, network-path, foreign-DID,
  or external URL method ids.
- Preserve historical foreign-DID service ids during ledger resolution under an
  explicit read-only compatibility policy; new service writes remain
  subject-bound. Network-path verification method ids now map to structured
  `invalidDid` resolution diagnostics.
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

### Migration from 0.5.0

Downstream consumers pinned to the exact published 0.5.0 packages should update
all coordinated `@midnight-ntwrk/midnight-did-*` dependencies together to a
0.6.0 snapshot for pre-release validation, or to 0.6.0 once available. Do not
point an exact 0.5.0 dependency at this breaking source revision.

Before removing a verification method, remove each selected verification
relationship explicitly with `removeVerificationMethodRelation`, wait for and
confirm each transaction in order, and only then call
`removeVerificationMethod` or `removeSchnorrJubjubVerificationMethod`. Handle
`VerificationMethodReferencedError` by inspecting its ordered `relations`,
re-reading ledger state after ambiguous or partial failures, and submitting only
the still-required relationship removals. Pending controller-state
reconciliation must identify the DID explicitly: pass `contractAddress` to
`recoverPendingControllerPrivateState` or
`discardPendingControllerPrivateState` together with the applicable confirmed
finalization outcome.

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
