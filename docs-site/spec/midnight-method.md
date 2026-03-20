# Midnight DID Method

The canonical source remains:

- `w3c-spec/midnight-method.md`

## Full source doc

- [Embedded method spec source](/source/spec-midnight-method)

## What this specification defines

- DID syntax for `did:midnight:<network>:<64-hex>`
- DID document structure and metadata
- supported verification method profiles
- verification relationships
- service model
- ledger state model
- lifecycle operations

## Main implementation mapping

| Spec concern | Primary implementation location |
|---|---|
| DID syntax and DID parsing | `domain/src/midnight.ts` |
| DID document validation | `domain/src/did-document.ts` |
| Ledger-to-document reconstruction | `did/src/ledger-to-domain.ts` |
| Runtime operations and orchestration | `api/src/lib.ts` |
| Contract state transitions | `contract/src/did.compact` |

## Read this when

- you need to check whether behavior belongs to contract, SDK, or resolver
- you need the canonical statement of operation rules
- you are reviewing deviations between implementation and method semantics

## Practical note

The implementation intentionally splits responsibilities:

- Compact contract for on-ledger state transitions
- domain/did/api layers for canonicalization and DID document semantics

That boundary is documented further in:

- [ADR: SDK and Contract Boundary](/architecture/adr-sdk-contract-boundary)
