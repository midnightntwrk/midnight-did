# @midnight-ntwrk/midnight-did-domain

Domain model and validation layer for Midnight DID documents and metadata.

## Responsibilities

- DID/DID URL parsing and validation
- DID Document schemas and normalization
- Canonical reference handling (fragment vs absolute DID URL)
- Service endpoint and key schema constraints

## Architecture

```mermaid
graph TD
  Inputs[API / Manager / Resolver inputs]
  Domain[Domain schemas + normalization]
  Outputs[Canonical DID document model]

  Inputs --> Domain --> Outputs
```

## Normalization Sequence

```mermaid
sequenceDiagram
  participant Caller
  participant Domain

  Caller->>Domain: DID document payload
  Domain->>Domain: parse + schema validation
  Domain->>Domain: canonicalize identifiers/references
  Domain->>Domain: enforce relation/service constraints
  Domain-->>Caller: normalized domain object
```

## DID Document Validation State (conceptual)

```mermaid
stateDiagram-v2
  [*] --> Parsed
  Parsed --> Canonicalized
  Canonicalized --> Valid : all constraints satisfied
  Canonicalized --> Invalid : schema/semantic violation
  Valid --> [*]
  Invalid --> [*]
```

## Build & Test

- Build: `pnpm --filter ./packages/domain build`
- Test: `pnpm --filter ./packages/domain test`
- Coverage: `pnpm --filter ./packages/domain coverage`

## Notes

- Domain is pure TypeScript and intentionally runtime-agnostic.
- API/Manager/Resolver depend on this package for consistent behavior.
