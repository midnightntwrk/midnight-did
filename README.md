# Midnight DID

Midnight DID is a reference implementation of the `did:midnight` method.
This repository contains the smart contract, domain model, resolver/conversion logic, API, CLI, and reusable secret storage.

## Workspace Components

| Component | Package | Responsibility |
|---|---|---|
| [`contract`](contract/README.md) | `@midnight-ntwrk/midnight-did-contract` | On-ledger DID state and circuit rules |
| [`domain`](domain/README.md) | `@midnight-ntwrk/midnight-did-domain` | DID schemas, validation, canonicalization |
| [`did`](did/README.md) | `@midnight-ntwrk/midnight-did` | Ledger ↔ domain mapping and resolver helpers |
| [`api`](api/README.md) | `@midnight-ntwrk/midnight-did-api` | Programmatic DID operations and orchestration |
| [`secret-storage`](secret-storage/README.md) | `@midnight-ntwrk/midnight-did-secret-storage` | Encrypted key storage + sign/verify/HD derivation |
| [`cli`](cli/README.md) | `@midnight-ntwrk/midnight-did-cli` | User-facing shell + state-machine-guided flows |
| [`did-resolver-service`](did-resolver-service/README.md) | `@midnight-ntwrk/midnight-did-resolver-service` | REST/Swagger/UI DID resolver service |
| [`did-manager-service`](did-manager-service/README.md) | `@midnight-ntwrk/midnight-did-manager-service` | Web DID management backend + minimal UI |

## Architecture

```mermaid
graph TD
  U[User / Integrator]

  CLI[CLI]
  API[API]
  ResolverSvc[Resolver Service]
  DidPkg[DID package]
  Domain[Domain]
  Contract[Contract]
  Secrets[Secret Storage]

  Indexer[(Indexer)]
  Node[(Midnight Node)]
  Proof[(Proof Server)]

  U --> CLI
  U --> API
  U --> ResolverSvc

  CLI --> API
  CLI --> Secrets

  API --> DidPkg
  API --> Domain
  API --> Contract

  ResolverSvc --> DidPkg
  ResolverSvc --> Domain

  DidPkg --> Domain
  DidPkg --> Contract

  API --> Indexer
  API --> Node
  API --> Proof
  ResolverSvc --> Indexer
```

## DID Update and Resolution Sequence

```mermaid
sequenceDiagram
  participant User
  participant CLI as CLI / App
  participant API
  participant Contract
  participant Indexer
  participant Resolver

  User->>CLI: add verification method (from keyRef)
  CLI->>API: validate command + current state
  API->>Contract: submit addVerificationMethod circuit
  Contract-->>API: tx accepted
  API->>Indexer: wait/read updated ledger state
  API-->>CLI: operation result + hints

  User->>Resolver: DID Resolution request (GET /resolve/{did})
  Resolver->>Indexer: read latest ledger state
  Resolver-->>User: DID Resolution Result
```

## DID Lifecycle State Machine

```mermaid
stateDiagram-v2
  [*] --> NoContract
  NoContract --> DidActive : deploy/join
  DidActive --> DidActive : add/update/remove methods, services, aliases, relations
  DidActive --> DidDeactivated : deactivate
  DidDeactivated --> [*]
```

## Running

Prerequisites:
- Node 24+
- npm 10+
- Docker (for integration tests)

Install:
- `npm ci`

Pipelines:
- Full workspace: `./run.sh`
- API only: `./run-api.sh`
- CLI only: `./run-cli.sh`
- Resolver only: `./run-resolver.sh`
- DID manager only: `./run-manager.sh`

## Notes

- Compact circuits are compiled via workspace scripts in `contract`.
- Integration tests use Testcontainers and docker-compose based topologies.
- Teardown logic now performs best-effort `docker compose down --volumes --remove-orphans` to reduce leaked resources.
- DID Resolution responses follow the DID Core shape:
  - `didDocument`
  - `didResolutionMetadata`
  - `didDocumentMetadata`

## License

Apache-2.0
