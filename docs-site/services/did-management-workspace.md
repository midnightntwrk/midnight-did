# DID Management Workspace

DID Management is the on-chain workspace for DID contract deployment/join and DID document CRUD.

## Concept in 30 seconds

- Choose a validated contract or deploy a new one.
- Join contract in current wallet session.
- Manage verification methods, relations, services, aliases.
- Track operation/indexing progress in diagnostics and operation log.

## Why this page exists

It isolates DID lifecycle from wallet bootstrap and local key custody:

- wallet readiness is a prerequisite
- contract selection/join is explicit
- every DID mutation is asynchronous and traceable

## Field reference

## DID Contract panel

| Field | Purpose | Notes |
| --- | --- | --- |
| `Deploy DID Contract` | Deploy new contract | Requires an active wallet session |
| `Stored contracts` | Select known/available contract | Validated against network |
| `Join contract address` | Explicit contract input | Must be lowercase 64-char hex |
| `Join DID Contract` | Join selected/manual contract | Enables DID CRUD |

## DID tabs

| Tab | Purpose |
| --- | --- |
| `Document` | Full DID document + metadata |
| `Summary` | Contract, status, version, counts |

## DID operations

| Group | Operations |
| --- | --- |
| Verification methods | Add, update, remove |
| Relations | Add, remove authentication/assertion/capability relations |
| Services | Add, update, remove service endpoints |
| Aliases | Add, remove `alsoKnownAs` |
| Lifecycle | Deactivate DID |

## Diagnostics and operation feedback

Use these together:

- backend state indicators (connection, DID phase, current op)
- operation log (accepted, running, indexed, failed)
- DID summary version and operation counts

This gives visibility across publish and indexing phases.

## Preconditions

1. Wallet session must be `ready`.
2. Secret Storage must contain key material for verification methods.
3. Joined DID contract must be available on selected setup.

## Related docs

- [DID Manager Getting Started](/guide/getting-started-did-manager)
- [Wallet Setup workspace](/services/wallet-setup)
- [Secret Storage workspace](/services/secret-storage-workspace)
- [DID Manager architecture](/architecture/did-manager-service)
