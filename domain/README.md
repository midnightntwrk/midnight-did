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
  Inputs[API / CLI / Resolver inputs]
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

- Build: `npm run build -w domain`
- Test: `npm run test -w domain`
- Coverage: `npm run coverage -w domain`

## Notes

- Domain is pure TypeScript and intentionally runtime-agnostic.
- API/CLI/Resolver depend on this package for consistent behavior.
