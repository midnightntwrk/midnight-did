# @midnight-ntwrk/midnight-did

Mapping layer between on-ledger contract state and DID Core-compatible domain documents.

## Responsibilities

- Convert contract ledger data to domain DID documents
- Resolve canonical absolute DID URLs from stored fragment identifiers
- Provide network/identifier utilities for `did:midnight`

## Architecture

```mermaid
graph TD
  Ledger[(Contract ledger state)]
  Mapper[LedgerToDomain]
  Domain[Domain DID document]
  Resolver[Resolver/API consumers]

  Ledger --> Mapper --> Domain --> Resolver
```

## Resolution Sequence

```mermaid
sequenceDiagram
  participant Consumer
  participant DIDPkg as did package
  participant Mapper as LedgerToDomain
  participant Domain

  Consumer->>DIDPkg: DID Resolution input (DID string)
  DIDPkg->>Mapper: map ledger state
  Mapper->>Domain: construct canonical document
  Domain-->>DIDPkg: validated model
  DIDPkg-->>Consumer: DID Resolution Result
```

## Identifier Canonicalization

```mermaid
stateDiagram-v2
  [*] --> FragmentStored
  FragmentStored --> AbsoluteReference : during resolution
  AbsoluteReference --> [*]
```

Resolution output uses absolute DID URL references where required by DID Core,
while compact fragment identifiers may still be used in ledger storage.

## Build & Test

- Build: `npm run build -w ./packages/did`
- Test: `npm run test -w ./packages/did -- --pool=threads`
- Coverage: `npm run coverage -w ./packages/did`
