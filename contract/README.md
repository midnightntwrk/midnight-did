# @midnight-ntwrk/midnight-did-contract

Compact smart-contract implementation for Midnight DID ledger state.

## Responsibilities

- Store DID state on-ledger (methods, relations, services, aliases, metadata)
- Enforce on-chain invariants and authorization checks
- Expose circuits for DID lifecycle operations
- Provide pure circuit helpers (including Jubjub signature verification)

## Architecture

```mermaid
graph TD
  API[API]
  Contract[did.compact circuits]
  Ledger[(On-chain DID state)]

  API --> Contract
  Contract --> Ledger
```

## Circuit Flow (example: add verification method)

```mermaid
sequenceDiagram
  participant Caller
  participant Circuit as addVerificationMethod
  participant Ledger

  Caller->>Circuit: VerificationMethod input
  Circuit->>Circuit: controller auth check
  Circuit->>Circuit: key type/curve constraints
  Circuit->>Circuit: duplicate/non-existence checks
  Circuit->>Ledger: insert/update state
  Circuit->>Ledger: increment version + operationCount
```

## On-ledger State Lifecycle

```mermaid
stateDiagram-v2
  [*] --> Active
  Active --> Active : add/update/remove methods, relations, services, aliases
  Active --> Deactivated : deactivate()
  Deactivated --> [*]
```

## Build & Test

- Compile compact artifacts: `npm run contract -w contract`
- Build TS artifacts: `npm run build -w contract`
- Tests: `npm run test -w contract -- --pool=threads`
- Coverage: `npm run coverage -w contract`

## Notes

- Contract-level checks focus on enforceable on-chain invariants.
- Some full DID conformance checks are intentionally handled at SDK/domain layers.
- Jubjub verifier circuit is available for domain/contract compatibility testing.
