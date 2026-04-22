# Packages

The Midnight DID workspace is split into reusable TypeScript packages.

## Current package map

| Package | Purpose | Main source doc |
|---|---|---|
| `@midnight-ntwrk/midnight-did-domain` | DID schemas, validation, codecs, normalization | `domain/README.md` |
| `@midnight-ntwrk/midnight-did` | Ledger/domain mapping and resolver helpers | `did/README.md` |
| `@midnight-ntwrk/midnight-did-api` | Programmatic DID operations and runtime orchestration | `api/README.md` |
| `@midnight-ntwrk/midnight-did-secret-storage` | Secret storage, signing, verification, HD derivation | `secret-storage/README.md` |
| `@midnight-ntwrk/midnight-did-credentials-openid` | OID4VCI/OID4VP-inspired envelopes for Midnight Compact VC/VP payloads | `credentials-openid/README.md` |
| `@midnight-ntwrk/midnight-did-credentials-passport` | Passport credential family used by the prototype | `midnight-passport-prototype/packages/credentials-passport/README.md` |
| `@midnight-ntwrk/midnight-did-credentials-passport-secret` | Hidden-holder Passport credential family used by the prototype | `midnight-passport-prototype/packages/credentials-passport-secret/README.md` |
| `@midnight-ntwrk/midnight-did-credentials-compliance` | Compliance screening credential family used by the prototype | `midnight-passport-prototype/packages/credentials-compliance/README.md` |

## How to read this section

- `domain` is the source of truth for document shape and normalization.
- `did` maps ledger state into DID Core-compatible domain objects.
- `api` is the runtime facade over providers, contract operations, and resolution flows.
- `secret-storage` owns seed parsing, key storage, derivation, signing, and verification.
- `credentials-openid` owns transport-neutral OpenID-shaped message schemas and Compact value framing.
- Passport-specific credential packages live inside `midnight-passport-prototype/packages` until their APIs are stable enough to promote to reusable root packages.

This section is also the future target for generated API reference pages.

## Practical pages

Each package also has an example page with copyable usage patterns:

- [Domain Examples](/packages/domain-examples)
- [DID Examples](/packages/did-examples)
- [API Examples](/packages/api-examples)
- [Secret Storage Examples](/packages/secret-storage-examples)
- [Credentials OpenID](/packages/credentials-openid)
- [Midnight Passport Prototype](/use-cases/midnight-passport-prototype)
