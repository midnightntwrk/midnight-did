#!/usr/bin/env bash
set -euo pipefail

node ./scripts/ensure-node-24.mjs

usage() {
  cat <<'EOF'
Usage: ./start-resolver.sh [--standalone|--preprod|--preproad|--mainnet]

Starts did-resolver-service in the selected network profile.

Options:
  --standalone   Use local standalone Docker infra (default)
  --preprod      Use preprod indexer
  --preproad     Alias for --preprod
  --mainnet      Use mainnet indexer defaults (overridable via env vars)
  --help         Show this help
EOF
}

container_port() {
  local container_name="$1"
  local port_spec="$2"
  local mapping

  mapping="$(docker port "${container_name}" "${port_spec}" 2>/dev/null || true)"
  if [[ -z "${mapping}" ]]; then
    echo "[start-resolver] Cannot resolve ${port_spec} for container ${container_name}." >&2
    echo "[start-resolver] Ensure standalone Docker infra is already running:" >&2
    echo "  docker compose -f api/standalone.yml up -d" >&2
    exit 1
  fi

  echo "${mapping##*:}"
}

profile="standalone"
if [[ $# -gt 1 ]]; then
  usage >&2
  exit 1
fi

if [[ $# -eq 1 ]]; then
  case "$1" in
    --standalone)
      profile="standalone"
      ;;
    --preprod|--preproad)
      profile="preprod"
      ;;
    --mainnet)
      profile="mainnet"
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "[start-resolver] Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
fi

export RESOLVER_HOST="${RESOLVER_HOST:-127.0.0.1}"
export RESOLVER_PORT="${RESOLVER_PORT:-3001}"
export RESOLVER_ENABLE_DOCS="${RESOLVER_ENABLE_DOCS:-true}"
export RESOLVER_TIMEOUT_MS="${RESOLVER_TIMEOUT_MS:-15000}"

if [[ "${profile}" == "standalone" ]]; then
  INDEXER_PORT="${MIDNIGHT_STANDALONE_INDEXER_PORT:-$(container_port did-indexer 8088/tcp)}"

  export MIDNIGHT_NETWORK="${MIDNIGHT_NETWORK:-undeployed}"
  export MIDNIGHT_INDEXER_HTTP_URL="${MIDNIGHT_INDEXER_HTTP_URL:-http://127.0.0.1:${INDEXER_PORT}/api/v3/graphql}"
  export MIDNIGHT_INDEXER_WS_URL="${MIDNIGHT_INDEXER_WS_URL:-ws://127.0.0.1:${INDEXER_PORT}/api/v3/graphql/ws}"

  echo "[start-resolver] Starting did-resolver-service in standalone mode"
elif [[ "${profile}" == "preprod" ]]; then
  export MIDNIGHT_NETWORK="${MIDNIGHT_NETWORK:-preprod}"
  export MIDNIGHT_INDEXER_HTTP_URL="${MIDNIGHT_INDEXER_HTTP_URL:-https://indexer.preprod.midnight.network/api/v4/graphql}"
  export MIDNIGHT_INDEXER_WS_URL="${MIDNIGHT_INDEXER_WS_URL:-wss://indexer.preprod.midnight.network/api/v4/graphql/ws}"

  echo "[start-resolver] Starting did-resolver-service in preprod mode"
else
  export MIDNIGHT_NETWORK="${MIDNIGHT_NETWORK:-mainnet}"
  export MIDNIGHT_INDEXER_HTTP_URL="${MIDNIGHT_INDEXER_HTTP_URL:-https://indexer.mainnet.midnight.network/api/v4/graphql}"
  export MIDNIGHT_INDEXER_WS_URL="${MIDNIGHT_INDEXER_WS_URL:-wss://indexer.mainnet.midnight.network/api/v4/graphql/ws}"

  echo "[start-resolver] Starting did-resolver-service in mainnet mode"
fi

echo "[start-resolver] Network: ${MIDNIGHT_NETWORK}"
echo "[start-resolver] Indexer HTTP: ${MIDNIGHT_INDEXER_HTTP_URL}"
echo "[start-resolver] Indexer WS: ${MIDNIGHT_INDEXER_WS_URL}"
echo "[start-resolver] Open http://${RESOLVER_HOST}:${RESOLVER_PORT}"

npm run dev -w did-resolver-service
