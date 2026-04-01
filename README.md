# Midnight DID

Midnight DID is a reference implementation of the `did:midnight` method.
This repository contains the smart contract, domain model, resolver/conversion logic, API, web services, and reusable secret storage.

## Workspace Components

| Component | Package | Responsibility |
|---|---|---|
| [`contract`](contract/README.md) | `@midnight-ntwrk/midnight-did-contract` | On-ledger DID state and circuit rules |
| [`domain`](domain/README.md) | `@midnight-ntwrk/midnight-did-domain` | DID schemas, validation, canonicalization |
| [`did`](did/README.md) | `@midnight-ntwrk/midnight-did` | Ledger ↔ domain mapping and resolver helpers |
| [`api`](api/README.md) | `@midnight-ntwrk/midnight-did-api` | Programmatic DID operations and orchestration |
| [`secret-storage`](secret-storage/README.md) | `@midnight-ntwrk/midnight-did-secret-storage` | Encrypted key storage + sign/verify/HD derivation |
| [`did-resolver-service`](did-resolver-service/README.md) | `@midnight-ntwrk/midnight-did-resolver-service` | REST/Swagger/UI DID resolver service |
| [`did-manager-service`](did-manager-service/README.md) | `@midnight-ntwrk/midnight-did-manager-service` | Web DID management backend + minimal UI |

## Architecture

```mermaid
graph TD
  U[User / Integrator]

  API[API]
  ResolverSvc[Resolver Service]
  ManagerSvc[Manager Service]
  DidPkg[DID package]
  Domain[Domain]
  Contract[Contract]
  Secrets[Secret Storage]

  Indexer[(Indexer)]
  Node[(Midnight Node)]
  Proof[(Proof Server)]

  U --> API
  U --> ResolverSvc
  U --> ManagerSvc

  API --> DidPkg
  API --> Domain
  API --> Contract

  ResolverSvc --> DidPkg
  ResolverSvc --> Domain
  ManagerSvc --> API
  ManagerSvc --> Secrets

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
  participant App as Manager / App
  participant API
  participant Contract
  participant Indexer
  participant Resolver

  User->>App: add verification method (from keyRef)
  App->>API: validate command + current state
  API->>Contract: submit addVerificationMethod circuit
  Contract-->>API: tx accepted
  API->>Indexer: wait/read updated ledger state
  API-->>App: operation result + hints

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
- Resolver only: `./run-resolver.sh`
- DID manager only: `./run-manager.sh`
- Docs pipeline: `./run-docs.sh`
- Manager app: `./start-manager.sh [--standalone|--preprod]`
- Resolver app: `./start-resolver.sh [--standalone|--preprod]`
- Docs dev server: `./start-docs.sh`

Docs site local URL:
- `http://127.0.0.1:4173`

## Developer Entry Points

If you are new to the repository, start here:

1. `./start-docs.sh`
2. `SKIP_LONG_RUNNING=1 ./run.sh`
3. the component-specific runner for the area you are changing

Docs helpers:

- `./run-docs.sh` runs the full docs preparation and build workflow
- `./start-docs.sh` starts the local VitePress site

When you need direct package/service documentation:

- `api/README.md`
- `domain/README.md`
- `did/README.md`
- `secret-storage/README.md`
- `did-resolver-service/README.md`
- `did-manager-service/README.md`

## Notes

- Compact circuits are compiled via workspace scripts in `contract`.
- Integration tests use Testcontainers and docker-compose based topologies.
- Teardown logic now performs best-effort `docker compose down --volumes --remove-orphans` to reduce leaked resources.
- HD seed derivation for `Ed25519`, `Jubjub`, and `P-256` is documented in [`secret-storage/README.md`](secret-storage/README.md).
- DID Resolution responses follow the DID Core shape:
  - `didDocument`
  - `didResolutionMetadata`
  - `didDocumentMetadata`

## License

Apache-2.0
