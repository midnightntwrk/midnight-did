# @midnight-ntwrk/midnight-did-secret-storage

Reusable encrypted secret storage for Midnight DID key lifecycle operations.

## Responsibilities

- Generate/import/list/delete keys
- Derive keys from seed (HD-style derivation)
- Sign and verify payloads
- Keep private key material encrypted at rest

## Architecture

```mermaid
graph TD
  CLI[CLI / Services]
  API[SecretStorage interface]
  FileStore[Encrypted file backend]
  Veramo[Veramo adapter]
  Crypto[crypto + derivation helpers]

  CLI --> API
  API --> FileStore
  API --> Veramo
  FileStore --> Crypto
  Veramo --> Crypto
```

## Signing Flow

```mermaid
sequenceDiagram
  participant Caller
  participant Store as SecretStorage
  participant Backend as File backend
  participant Crypto

  Caller->>Store: sign(keyRef, payload)
  Store->>Backend: load encrypted key record
  Backend->>Crypto: decrypt + curve-specific sign
  Crypto-->>Store: signature bytes
  Store-->>Caller: signature
```

## Key/Curve Capability State

```mermaid
stateDiagram-v2
  [*] --> KeyStored
  KeyStored --> CanSignVerify : Ed25519 / P-256 / Jubjub
  CanSignVerify --> [*]
```

## Supported Curves

- Ed25519
- P-256
- Jubjub

Jubjub signing/verification is aligned with contract-compatible verification paths used in this repository.

## Security Model (file backend)

- encrypted JSON envelope
- `scrypt` key derivation from passphrase
- AES-256-GCM encryption
- minimal metadata in plaintext; private key bytes encrypted

## Build & Test

- Build: `npm run build -w secret-storage`
- Lint: `npm run lint -w secret-storage`
- Typecheck: `npm run typecheck -w secret-storage`
- Tests are currently exercised via CLI suite:
  - `npm run test:cli-api -w cli`
