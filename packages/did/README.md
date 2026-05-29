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

## Resolution Result Shape

The package resolver returns the DID Core abstract resolution shape: a DID
Document plus DID Document metadata. Resolver services that expose the full DID
Resolution Result envelope should add `didResolutionMetadata` as a separate
object. For successful abstract `resolve` calls, that metadata object must not
include `contentType`.

Use `contentType` only for `resolveRepresentation`-style responses where the
body is a DID Document byte stream. Midnight DID Document representations should
be reported as `application/did+ld+json` for JSON-LD streams or
`application/did+json` for DID Core JSON streams.

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

- Build: `pnpm --filter ./packages/did build`
- Test: `pnpm --filter ./packages/did test -- --pool=threads`
- Coverage: `pnpm --filter ./packages/did coverage`
