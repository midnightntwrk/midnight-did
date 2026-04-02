# Secret Storage Workspace

Secret Storage is the local key custody workspace. Keys stay local until DID operations reference their `keyRef`.

## Concept in 30 seconds

- Generate/import/derive keys locally.
- Keep private keys encrypted at rest.
- Publish only public material to DID document.
- Use `keyRef` as stable key handle across operations.

## Why this page exists

It separates local key custody from on-chain DID mutation, making operator intent explicit:

- local key management is reversible and private
- DID document updates are public and persistent

## Field reference

## Key operations

| Field | Purpose | Notes |
| --- | --- | --- |
| `Key id` | Human-readable key label | Stored as metadata |
| `Key type` / `Curve` | Cryptographic profile | `Ed25519`, `Jubjub`, `P-256` |
| `Private key` | Import input (hex) | Only for import path |
| `Generate` | Create new key and keyRef | Local only |
| `Import` | Import provided private key | Local only |
| `Delete` | Remove key by `keyRef` | Local only |

## Key inventory

Shows each stored key with:

- `keyRef`
- metadata id
- key type (`kty`)
- curve (`crv`)

## HD derivation model

The manager uses the shared seed model from `@midnight-ntwrk/midnight-did-secret-storage`.

### Inputs

- `seedHex` (validated `Seed`: 64 lowercase hex chars)
- `kty`, `crv`
- optional `account`, `index`

### Midnight package usage

- `@midnight-ntwrk/wallet-sdk-hd`:
  - `HDWallet.fromSeed(seed)`
  - `deriveKey(account, Roles.Metadata, index)`
- `@midnight-ntwrk/ledger-v8`:
  - ledger/Compact representability checks for derived public keys

### Derivation convention

The derivation identity is a tuple:

- `(account, role=Metadata, index, candidate, kty, crv)`

`candidate` is incremented when the first deterministic output is not Compact/ledger compatible. This keeps derivation deterministic while guaranteeing a representable key.

### Curve behavior

| Curve | `kty` | Private key handling | Notes |
| --- | --- | --- | --- |
| `Ed25519` | `OKP` | 32-byte seed-expanded key path | Standard Ed25519 flow |
| `Jubjub` | `EC` | Scalarized for Jubjub field | Midnight-friendly zk/key usage |
| `P-256` | `EC` | Normalized into valid curve range | Useful for web/interoperable profiles |

### Example

```ts
import { FileSecretStore } from "@midnight-ntwrk/midnight-did-secret-storage";

const store = new FileSecretStore();
await store.initialize({ location: "/tmp/secrets.json", passphrase: "dev-pass" });

const result = await store.deriveKeyFromSeed({
  id: "auth-main",
  seedHex: "11".repeat(32),
  kty: "OKP",
  crv: "Ed25519",
  account: 0,
  index: 0,
});

console.log(result.keyRef, result.publicJwk);
```

## Related docs

- [DID Manager Getting Started](/guide/getting-started-did-manager)
- [Wallet Setup workspace](/services/wallet-setup)
- [DID Management workspace](/services/did-management-workspace)
- [Secret Storage package](/packages/secret-storage)
