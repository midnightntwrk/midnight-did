# DID Resolver Service

The DID resolver is a standalone Node.js service that resolves Midnight DIDs through the indexer-backed SDK flow and exposes both a REST API and a browser UI.

## Scope

- resolve DID documents and resolution metadata
- support standalone, preprod, and mainnet runtime profiles
- provide a simple UI for manual resolution checks

Quick start:

- [DID Resolver Getting Started](/guide/getting-started-did-resolver)

## Main endpoints

- `GET /health`
- `GET /ready`
- `GET /resolve/:did`
- `POST /resolve`
- `GET /docs`

## Runtime flow

```mermaid
sequenceDiagram
  participant Client
  participant Resolver
  participant Indexer
  participant Mapper as did/domain

  Client->>Resolver: resolve DID
  Resolver->>Resolver: validate DID and network
  Resolver->>Indexer: fetch latest ledger state
  Indexer-->>Resolver: contract state snapshot
  Resolver->>Mapper: construct DID Resolution Result
  Mapper-->>Resolver: normalized result
  Resolver-->>Client: didDocument + metadata
```

## Main configuration

| Variable | Purpose |
|---|---|
| `RESOLVER_HOST` | Bind host |
| `RESOLVER_PORT` | Bind port |
| `MIDNIGHT_NETWORK` | Target network profile |
| `MIDNIGHT_INDEXER_HTTP_URL` | Indexer HTTP endpoint |
| `MIDNIGHT_INDEXER_WS_URL` | Indexer WS endpoint |
| `RESOLVER_ENABLE_DOCS` | Enable Swagger UI |
| `RESOLVER_TIMEOUT_MS` | Request timeout |

## Run

```bash
npm run dev -w did-resolver-service
./start-resolver.sh --preprod
./start-resolver.sh --mainnet
```

`--mainnet` requires explicit `MIDNIGHT_INDEXER_HTTP_URL` and `MIDNIGHT_INDEXER_WS_URL` values.

## Main repository paths

- `did-resolver-service/src/index.ts`
- `did-resolver-service/src/app.ts`
- `did-resolver-service/src/service.ts`
- `did-resolver-service/README.md`

## Full source doc

- [Embedded Resolver README](/source/did-resolver-service-readme)
