# @midnight-ntwrk/midnight-did-jubjub-schnorr

Shared Jubjub Schnorr transcript and signature helpers for `midnight-did`.

This package exists to keep Compact verification and TypeScript signing on the
same protocol surface.

## Purpose

This package keeps Jubjub Schnorr transcript semantics in one reusable place.
The DID contract stores native SchnorrJubjub public keys and exposes a
ledger-bound verification circuit for method-id-based checks. Application
signing and reusable transcript helpers still live here.

## Package split

- [src/schnorr.compact](./src/schnorr.compact)
  - reusable Compact Schnorr module
  - owns challenge construction
  - owns witness-assisted reduction to a Jubjub-safe scalar
- [src/jubjub-schnorr.compact](./src/jubjub-schnorr.compact)
  - thin wrapper contract
  - exists so generated TS exposes `pureCircuits.schnorrChallengeDigest(...)`
- [src/signing.ts](./src/signing.ts)
  - TS digest adapter
  - TS signing / verification
  - 96-byte wire encoding

## Canonical transcript

The canonical in-circuit transcript is:

- announcement point `R`
- public key point `pk`
- `Vector<4, Field>` message digest

Compact challenge construction:

```compact
transientHash<SchnorrHashInput<4>>({
  ann_x,
  ann_y,
  pk_x,
  pk_y,
  msg
})
```

### Why a digest instead of raw bytes

Compact-native Schnorr verification works cleanly over field vectors, not
arbitrary byte arrays.

Identity applications still need to sign arbitrary payload bytes, so the public
application path is:

1. payload bytes
2. SHA-256 digest
3. split digest into four 64-bit field elements
4. sign / verify that `Vector<4, Field>`

That adapter is implemented by:

- `payloadToJubjubDigest(...)`

## Challenge reduction

`transientHash(...)` returns a BLS12-381 field element, but Jubjub scalar
operations require a smaller scalar.

The Compact module follows the zkloan pattern:

- compute `cFull`
- witness `(q, r)` such that `cFull = q * 2^248 + r`
- use `r` as the actual Jubjub challenge scalar

Every host contract that imports the shared `schnorr` module must implement
the witness with exactly this arithmetic:

```ts
const q = challengeHash / TWO_248;
const r = challengeHash % TWO_248;
return [privateState, [q, r]];
```

This witness contract is part of the protocol. If a consumer changes the
reduction rule, Compact verification and TS signing drift again.

Constants:

- `JUBJUB_ORDER`
- `TWO_248`

This keeps Compact and TS aligned on the same reduction rule.

## Wire format

The signature encoding stays compatible with the existing repository shape:

- 32 bytes: `R.x`
- 32 bytes: `R.y`
- 32 bytes: `s`

Total:

- `96` bytes

Helpers:

- `encodeJubjubSignature(...)`
- `decodeJubjubSignature(...)`

## Preferred usage

### For application code

Use this package directly when you need DID-owned Schnorr signing helpers. The
resolver repository is expected to consume the same helpers from its service
packages instead of reimplementing transcript logic.

This package exposes:

- `payloadToJubjubDigest`
- `signJubjubDigestFromSeed`
- `signJubjubPayloadFromSeed`
- `verifyJubjubPayload`
- signature encode/decode helpers

For DID-facing application code, prefer the deterministic seed-based helpers:

- `signJubjubDigestFromSeed(...)`
- `signJubjubPayloadFromSeed(...)`

`signJubjubDigest(...)` remains available as a lower-level API and uses a
random nonce when no `nonceSeed` is supplied.

### For contract code

Compact consumers that need standalone in-circuit verification can import
[`src/schnorr.compact`](./src/schnorr.compact) or use the wrapper contract in
[`src/jubjub-schnorr.compact`](./src/jubjub-schnorr.compact). The DID contract
exports only the ledger-bound SchnorrJubjub verifier, which looks up the public
key from DID ledger state by method id.
