@midnight-ntwrk/midnight-did-resolver-service

Purpose
- Node.js backend for Midnight DID resolution.
- Exposes Swagger/OpenAPI endpoints and a minimal browser UI.

Routes
- `GET /health`
- `GET /resolve/:did` (optional query: `indexerUrl`, `indexerWsUrl`)
- `POST /resolve` with JSON body `{ "did": "did:midnight:...", "indexerUrl"?: "...", "indexerWsUrl"?: "..." }`
- `GET /docs` (Swagger UI)
- `GET /` (simple resolver UI)

Environment Variables
- `RESOLVER_HOST` (default `127.0.0.1`)
- `RESOLVER_PORT` (default `3001`)
- `MIDNIGHT_INDEXER_HTTP_URL` (default `http://127.0.0.1:8088/api/v3/graphql`)
- `MIDNIGHT_INDEXER_WS_URL` (default `ws://127.0.0.1:8088/api/v3/graphql/ws`)
- `MIDNIGHT_INDEXER_ALLOWLIST` (optional comma-separated `http(s)` or `ws(s)` indexer override URLs; client-supplied `indexerUrl`/`indexerWsUrl` values are rejected unless they match this allowlist or the configured defaults)
- `MIDNIGHT_NETWORK` (optional strict network filter: `undeployed|devnet|testnet|mainnet|preview|preprod`)
- `RESOLVER_DEBUG` (optional: `true` to print underlying resolve errors to stderr)

Public Input Hardening
- Resolver routes only accept canonical Midnight DIDs matching `did:midnight:<network>:<64 hex chars>` and cap DID input length before any resolver/indexer work starts.
- Malformed HTTP DID inputs return `400 Bad Request` at the route boundary. Direct service-layer callers still receive a DID-resolution `invalidDid` envelope.
- `indexerUrl` and `indexerWsUrl` overrides are capped to 2048 characters, normalized, stripped of credentials/query/fragment parts, and rejected unless the normalized endpoint is configured by default or listed in `MIDNIGHT_INDEXER_ALLOWLIST`.
- Debug logs redact URL credentials in option bags and exception messages. Avoid adding secret-bearing fields to resolver options; unknown HTTP fields are rejected by schema validation.
- The service has a request timeout guard, but it is not a rate limiter. When exposed outside a trusted network, run it behind an authenticated gateway or reverse proxy with IP/client quotas, burst limits, and request-body limits.

Run
- `npm run build -w did-resolver-service`
- `npm run start -w did-resolver-service`

Development
- `npm run dev -w did-resolver-service`
- `npm run test -w did-resolver-service`
- `npm run test:integration -w did-resolver-service` (builds/starts Docker image via Testcontainers)

Run Locally (No Docker)
- Prerequisites:
  - Node.js `>=24`
  - npm `>=10`
  - A reachable Midnight indexer endpoint (local or remote)
- Install dependencies at repo root:
  - `npm install`
- Configure resolver environment (example values):
  - `export RESOLVER_HOST=127.0.0.1`
  - `export RESOLVER_PORT=3001`
  - `export MIDNIGHT_INDEXER_HTTP_URL=http://127.0.0.1:8088/api/v3/graphql`
  - `export MIDNIGHT_INDEXER_WS_URL=ws://127.0.0.1:8088/api/v3/graphql/ws`
  - Optional client override allowlist:
  - `export MIDNIGHT_INDEXER_ALLOWLIST=https://indexer.example/api/v3/graphql,wss://indexer.example/api/v3/graphql/ws`
  - Optional network guard:
  - `export MIDNIGHT_NETWORK=undeployed`
- Start in development mode:
  - `npm run dev -w did-resolver-service`
- Or run compiled mode:
  - `npm run build -w did-resolver-service`
  - `npm run start -w did-resolver-service`
- Verify service:
  - `curl http://127.0.0.1:3001/health`
  - Open `http://127.0.0.1:3001/` (UI) or `http://127.0.0.1:3001/docs` (Swagger)

Docker
- Build image manually:
  - `docker build -f did-resolver-service/Dockerfile -t midnight-did-resolver:local .`
- Run image:
  - `docker run --rm -p 3001:3001 -e RESOLVER_HOST=0.0.0.0 midnight-did-resolver:local`
- The image runs as the non-root `node` user. In production, keep `indexerUrl` overrides disabled unless each allowed endpoint is listed in `MIDNIGHT_INDEXER_ALLOWLIST`, and place the resolver behind an authenticated gateway when exposed outside a trusted network.
