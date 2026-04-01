# Packages

The Midnight DID workspace is split into reusable TypeScript packages.

## Current package map

| Package | Purpose | Main source doc |
|---|---|---|
| `@midnight-ntwrk/midnight-did-domain` | DID schemas, validation, codecs, normalization | `domain/README.md` |
| `@midnight-ntwrk/midnight-did` | Ledger/domain mapping and resolver helpers | `did/README.md` |
| `@midnight-ntwrk/midnight-did-api` | Programmatic DID operations and runtime orchestration | `api/README.md` |
| `@midnight-ntwrk/midnight-did-secret-storage` | Secret storage, signing, verification, HD derivation | `secret-storage/README.md` |

## How to read this section

- `domain` is the source of truth for document shape and normalization.
- `did` maps ledger state into DID Core-compatible domain objects.
- `api` is the runtime facade over providers, contract operations, and resolution flows.
- `secret-storage` owns seed parsing, key storage, derivation, signing, and verification.

This section is also the future target for generated API reference pages.

## Practical pages

Each package also has an example page with copyable usage patterns:

- [Domain Examples](/packages/domain-examples)
- [DID Examples](/packages/did-examples)
- [API Examples](/packages/api-examples)
- [Secret Storage Examples](/packages/secret-storage-examples)
