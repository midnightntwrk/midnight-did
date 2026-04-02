# DID Resolver Getting Started

This guide walks through running and validating the DID Resolver service.

## Before you start

1. For standalone mode, start local infra first:

```bash
docker compose -f api/standalone.yml up -d
```

2. Start resolver:

```bash
./start-resolver.sh --standalone
# or
./start-resolver.sh --preprod
```

3. Open:

- UI: `http://127.0.0.1:3001/`
- API docs: `http://127.0.0.1:3001/docs`

## Runtime modes

| Mode | Command | Notes |
| --- | --- | --- |
| Standalone | `./start-resolver.sh --standalone` | Uses local Docker indexer and network `undeployed` |
| Preprod | `./start-resolver.sh --preprod` | Uses preprod indexer endpoints |
| Mainnet | `./start-resolver.sh --mainnet` | Uses mainnet indexer v4 defaults (overridable via env vars) |

Optional mainnet overrides:

```bash
MIDNIGHT_INDEXER_HTTP_URL=https://... \
MIDNIGHT_INDEXER_WS_URL=wss://... \
./start-resolver.sh --mainnet
```

## Validate service health

```bash
curl -s http://127.0.0.1:3001/health
curl -s http://127.0.0.1:3001/ready
```

Expected shape:

- `{"ok":true,...}` for `/health`
- readiness response for `/ready` once dependencies are reachable

## Resolve a DID

## GET form

```bash
curl -s "http://127.0.0.1:3001/resolve/did:midnight:undeployed:<contractAddress>"
```

## POST form

```bash
curl -s -X POST "http://127.0.0.1:3001/resolve" \
  -H "content-type: application/json" \
  -d '{"did":"did:midnight:undeployed:<contractAddress>"}'
```

Resolution returns a DID Resolution Result:

- `didDocument`
- `didDocumentMetadata`
- `didResolutionMetadata`

## Key concepts

- Resolver is read-only: it never mutates DID state.
- Network/profile are backend-configured; callers send DID only.
- DID format validation happens before indexer lookup.

## Troubleshooting

### Resolver cannot start in standalone mode

- Ensure `did-indexer` container is running:
  - `docker ps --filter name=did-indexer`
- Ensure ports can be resolved:
  - `docker port did-indexer 8088/tcp`

### `/ready` fails

- Check indexer endpoint values printed by `start-resolver.sh`.
- Validate endpoint manually:
  - `curl -s "$MIDNIGHT_INDEXER_HTTP_URL" | head`

### DID does not resolve

- Confirm DID network segment matches service network.
- Confirm contract address exists on the selected network.
- Check resolver logs for parsing/lookup failures.

## Related docs

- [DID Resolver service overview](/services/did-resolver-service)
- [Extending Resolver](/services/did-resolver-extension)
- [Local Development](/guide/local-development)
