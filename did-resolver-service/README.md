# @midnight-ntwrk/midnight-did-resolver-service

Standalone DID resolver service with REST API, Swagger UI, and a minimal web UI.

## Use It When

- you need DID Resolution Result responses over HTTP
- you want a browser-accessible resolver for manual inspection
- you want a service boundary separate from the CLI and manager applications

## Responsibilities

- Resolve `did:midnight` into DID Resolution Results
- Return DID Resolution Results as defined by DID Core:
  - `didDocument`
  - `didResolutionMetadata`
  - `didDocumentMetadata`
- Expose HTTP endpoints for resolution and health checks
- Support runtime-configurable indexer endpoints

## Architecture

```mermaid
graph TD
  Client[Browser / API Client]
  Fastify[Fastify Resolver Service]
  DidPkg[DID package]
  Domain[Domain package]
  Indexer[(Midnight Indexer)]

  Client --> Fastify
  Fastify --> DidPkg
  Fastify --> Domain
  Fastify --> Indexer
```

## DID Resolution Sequence

```mermaid
sequenceDiagram
  participant User
  participant Resolver as Resolver Service
  participant Indexer
  participant Mapper as DID/domain mapping

  User->>Resolver: DID Resolution input (GET /resolve/{did})
  Resolver->>Resolver: validate DID + network policy
  Resolver->>Indexer: query ledger state
  Indexer-->>Resolver: contract state snapshot
  Resolver->>Mapper: convert to domain DID document
  Mapper-->>Resolver: canonical DID document model
  Resolver-->>User: DID Resolution Result JSON
```

## Service State (request lifecycle)

```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Validating : incoming DID Resolution request
  Validating --> Resolving : valid DID
  Validating --> Rejected : invalid DID/network
  Resolving --> Responded : success or notFound/internalError
  Rejected --> Responded
  Responded --> Idle
```

## Endpoints

- `GET /health`
- `GET /ready`
- `GET /resolve/:did` (DID Resolution)
- `POST /resolve` with `{ "did": "did:midnight:..." }` (DID Resolution)
- `GET /docs` (Swagger UI, optional)
- `GET /` (simple HTML UI)

## Configuration

- `RESOLVER_HOST` (default `127.0.0.1`)
- `RESOLVER_PORT` (default `3001`)
- `MIDNIGHT_INDEXER_HTTP_URL`
- `MIDNIGHT_INDEXER_WS_URL`
- `MIDNIGHT_NETWORK` (`undeployed|devnet|testnet|mainnet|preview|preprod`)
- `RESOLVER_DEBUG=true` (optional verbose errors)
- `RESOLVER_ENABLE_DOCS=true|false` (default `true`)
- `RESOLVER_TIMEOUT_MS` (default `15000`)

## Runtime Profiles

- standalone via `./start-resolver.sh`
- preprod via `./start-resolver.sh --preprod`

## Production Defaults

- Request hardening:
  - body limit: `64KB`
  - request timeout: `15s`
  - connection timeout: `10s`
  - keep-alive timeout: `5s`
  - max param length: `1024`
- Response security headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
  - `Cross-Origin-Resource-Policy: same-origin`
- Graceful shutdown:
  - handles `SIGINT` and `SIGTERM`
  - closes Fastify app before exit

## Run

- Build: `npm run build -w did-resolver-service`
- Dev: `npm run dev -w did-resolver-service`
- Start: `npm run start -w did-resolver-service`
- Unit tests: `npm run test -w did-resolver-service`
- Integration tests: `npm run test:integration -w did-resolver-service`

Default local URL:
- `http://127.0.0.1:3001`

## Docker Integration Tests

Integration tests use compose + Testcontainers and now enforce cleanup via:
- `env.down({ removeVolumes: true })`
- fallback `docker compose down --volumes --remove-orphans`

This reduces dangling containers/volumes after failures.
