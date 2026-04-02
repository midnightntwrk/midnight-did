# ADR: HD Key Derivation and Ledger Compatibility

## Status

Accepted

## Context

The repository needs deterministic key derivation that is:

- compatible with Midnight wallet seed semantics
- reusable across manager/backend automation flows
- safe for on-ledger DID usage, where public key coordinates must fit Compact field constraints

Different curves (`Ed25519`, `Jubjub`, `P-256`) also require curve-specific private key handling.

## Decision

Use a deterministic, two-stage derivation model in `secret-storage`:

1. derive a Midnight metadata key from the validated seed via `@midnight-ntwrk/wallet-sdk-hd`
2. derive curve-specific private key bytes via HKDF-SHA256 and curve normalization rules

Then enforce ledger compatibility when importing/using the key for DID workflows.

## Implementation map

| Step | Function(s) | Package / primitive | File |
|---|---|---|---|
| Seed validation | `SeedSchema`, `parseSeed`, `seedToBuffer` | `zod`, Node buffers | `secret-storage/src/seed.ts` |
| Metadata key derivation | `deriveMetadataKey` | `@midnight-ntwrk/wallet-sdk-hd` (`HDWallet`, `Roles.Metadata`) | `secret-storage/src/hd-derivation.ts` |
| HKDF expansion | `hkdfSync` with salt/info contract | Node `crypto` HKDF | `secret-storage/src/hd-derivation.ts` |
| Curve-specific private key shaping | `deriveCurvePrivateFromSeed`, `normalizeP256Private` | curve logic + bigint math | `secret-storage/src/hd-derivation.ts` |
| Key import + public key materialization | `importCurveKey` | Node crypto + Jubjub helpers | `secret-storage/src/curve-support.ts` |
| Ledger representability checks | `isPublicJwkLedgerCompatible`, `assertPublicJwkLedgerCompatible` | `@midnight-ntwrk/ledger-v8` (`maxField`, field helpers) | `secret-storage/src/curve-support.ts` |
| Retry for representable key | `FileSecretStore.deriveKeyFromSeed` (`candidate` loop) | `secret-storage` store logic | `secret-storage/src/file-secret-store.ts` |

## Derivation contract

Given:

- `seedHex`
- `account` (default `0`)
- `index` (default `0`)
- `kty`, `crv`
- `candidate` (retry index, default `0`)

Derivation uses:

- HKDF salt: `midnight-did-secret-storage-v1`
- HKDF info: `midnight-did:key:v1:<kty>:<crv>:<account>:<index>:<candidate>`
- output length: 32 bytes

## Curve rules

| Curve | `kty` | Rule |
|---|---|---|
| `Ed25519` | `OKP` | use HKDF output as 32-byte private seed material |
| `Jubjub` | `EC` | use HKDF output and Jubjub-specific import/signing path |
| `P-256` | `EC` | normalize into valid scalar range: `(value mod (order - 1)) + 1` |

## Candidate retry behavior

`FileSecretStore.deriveKeyFromSeed(...)` retries up to 512 candidates when a derived key is not representable in Midnight Compact fields.  
This keeps derivation deterministic while still finding a valid ledger-compatible key.

## Examples

### Low-level deterministic derivation

```ts
import { deriveCurvePrivateFromSeed } from "@midnight-ntwrk/midnight-did-secret-storage";

const derived = deriveCurvePrivateFromSeed({
  id: "auth-main",
  seedHex: "11".repeat(32),
  kty: "OKP",
  crv: "Ed25519",
  account: 0,
  index: 0,
});
```

### Store-level derivation with retry and persistence

```ts
import { FileSecretStore } from "@midnight-ntwrk/midnight-did-secret-storage";

const store = new FileSecretStore();
await store.initialize({
  location: "/tmp/midnight-did-secrets.json",
  passphrase: "dev-passphrase",
});

const { keyRef, publicJwk } = await store.deriveKeyFromSeed({
  id: "did-auth-main",
  seedHex: "22".repeat(32),
  kty: "EC",
  crv: "Jubjub",
  account: 0,
  index: 1,
});
```

## Consequences

### Positive

- deterministic recovery for seed-based profiles
- one derivation model across manager and backend automation
- explicit ledger-compatibility enforcement before DID usage
- curve-specific behavior is centralized and testable

### Negative

- additional complexity from candidate retry logic
- derivation contract is now a compatibility surface that must remain stable

## Related docs

- [Secret Storage Package](/packages/secret-storage)
- [Secret Storage Examples](/packages/secret-storage-examples)
- [ADR: Shared Seed and Local Profiles](/architecture/adr-shared-seed-and-profiles)
