#!/usr/bin/env bash
set -euo pipefail

node ./scripts/ensure-node-24.mjs

export MIDNIGHT_NETWORK="${MIDNIGHT_NETWORK:-preprod}"
export MIDNIGHT_INDEXER_HTTP_URL="${MIDNIGHT_INDEXER_HTTP_URL:-https://indexer.preprod.midnight.network/api/v3/graphql}"
export MIDNIGHT_INDEXER_WS_URL="${MIDNIGHT_INDEXER_WS_URL:-wss://indexer.preprod.midnight.network/api/v3/graphql/ws}"
export RESOLVER_HOST="${RESOLVER_HOST:-127.0.0.1}"
export RESOLVER_PORT="${RESOLVER_PORT:-3001}"
export RESOLVER_ENABLE_DOCS="${RESOLVER_ENABLE_DOCS:-true}"
export RESOLVER_TIMEOUT_MS="${RESOLVER_TIMEOUT_MS:-15000}"

echo "[resolver-preprod] Starting did-resolver-service in preprod mode"
echo "[resolver-preprod] Network: ${MIDNIGHT_NETWORK}"
echo "[resolver-preprod] Indexer HTTP: ${MIDNIGHT_INDEXER_HTTP_URL}"
echo "[resolver-preprod] Indexer WS: ${MIDNIGHT_INDEXER_WS_URL}"
echo "[resolver-preprod] Open http://${RESOLVER_HOST}:${RESOLVER_PORT}"

npm run dev -w did-resolver-service
