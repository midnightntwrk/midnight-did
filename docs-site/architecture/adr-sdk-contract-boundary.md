# ADR: SDK and Contract Boundary

## Status

Accepted

## Context

The Compact contract enforces core on-ledger invariants, but not every DID Core or method-level rule belongs on-chain. Some checks depend on canonicalization, document reconstruction, or runtime-level data shaping.

## Decision

Split responsibilities:

- Contract:
  - enforce on-ledger state transitions
  - enforce controller/secret-key authorization
  - prevent impossible or unsafe relation/method states where feasible
- SDK/domain/resolver layers:
  - canonicalize identifiers
  - reconstruct DID documents
  - enforce method-level shape and serialization rules
  - present DID Resolution Result semantics

## Consequences

### Positive

- contract logic stays bounded and realistic
- DID Core conformance lives where document semantics can actually be expressed
- CLI, resolver, and manager all consume the same normalized behavior

### Negative

- some guarantees only exist at the SDK/resolver boundary, not in raw contract calls
- public documentation must be explicit about which layer owns which rule

## Main implementation points

- `contract/src/did.compact`
- `domain/src/did-document.ts`
- `did/src/ledger-to-domain.ts`
- `api/src/lib.ts`
