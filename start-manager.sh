#!/usr/bin/env bash
set -euo pipefail

node ./scripts/ensure-node-24.mjs

usage() {
  cat <<'EOF'
Usage: ./start-manager.sh [--standalone|--preprod|--preproad]

Starts did-manager-service in the selected network profile.

Options:
  --standalone   Use local standalone Docker infra (default)
  --preprod      Use preprod indexer/node and local proof server
  --preproad     Alias for --preprod
  --help         Show this help
EOF
}

container_port() {
  local container_name="$1"
  local port_spec="$2"
  local mapping

  mapping="$(docker port "${container_name}" "${port_spec}" 2>/dev/null || true)"
  if [[ -z "${mapping}" ]]; then
    echo "[start-manager] Cannot resolve ${port_spec} for container ${container_name}." >&2
    echo "[start-manager] Ensure standalone Docker infra is already running:" >&2
    echo "  docker compose -f api/standalone.yml up -d" >&2
    exit 1
  fi

  echo "${mapping##*:}"
}

wait_for_proof_server() {
  local deadline=$((SECONDS + 180))
  until curl -fsS "${DID_MANAGER_PREPROD_PROOF_SERVER}/version" >/dev/null 2>&1; do
    if (( SECONDS >= deadline )); then
      echo "[start-manager] Proof server did not become ready at ${DID_MANAGER_PREPROD_PROOF_SERVER}" >&2
      exit 1
    fi
    sleep 2
  done
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
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "[start-manager] Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
fi

export DID_MANAGER_SETUP="${DID_MANAGER_SETUP:-$profile}"
export DID_MANAGER_HOST="${DID_MANAGER_HOST:-127.0.0.1}"
export DID_MANAGER_PORT="${DID_MANAGER_PORT:-3010}"

if [[ "${profile}" == "standalone" ]]; then
  NODE_PORT="${DID_MANAGER_STANDALONE_NODE_PORT:-$(container_port did-node 9944/tcp)}"
  INDEXER_PORT="${DID_MANAGER_STANDALONE_INDEXER_PORT:-$(container_port did-indexer 8088/tcp)}"
  PROOF_PORT="${DID_MANAGER_STANDALONE_PROOF_SERVER_PORT:-$(container_port did-proof-server 6300/tcp)}"

  export DID_MANAGER_STANDALONE_NODE="${DID_MANAGER_STANDALONE_NODE:-http://127.0.0.1:${NODE_PORT}}"
  export DID_MANAGER_STANDALONE_INDEXER="${DID_MANAGER_STANDALONE_INDEXER:-http://127.0.0.1:${INDEXER_PORT}/api/v3/graphql}"
  export DID_MANAGER_STANDALONE_INDEXER_WS="${DID_MANAGER_STANDALONE_INDEXER_WS:-ws://127.0.0.1:${INDEXER_PORT}/api/v3/graphql/ws}"
  export DID_MANAGER_STANDALONE_PROOF_SERVER="${DID_MANAGER_STANDALONE_PROOF_SERVER:-http://127.0.0.1:${PROOF_PORT}}"

  echo "[start-manager] Starting did-manager-service in standalone mode"
  echo "[start-manager] Node: ${DID_MANAGER_STANDALONE_NODE}"
  echo "[start-manager] Indexer HTTP: ${DID_MANAGER_STANDALONE_INDEXER}"
  echo "[start-manager] Indexer WS: ${DID_MANAGER_STANDALONE_INDEXER_WS}"
  echo "[start-manager] Proof server: ${DID_MANAGER_STANDALONE_PROOF_SERVER}"
  echo "[start-manager] Open http://${DID_MANAGER_HOST}:${DID_MANAGER_PORT}/wallet"
else
  export DID_MANAGER_PREPROD_INDEXER="${DID_MANAGER_PREPROD_INDEXER:-https://indexer.preprod.midnight.network/api/v3/graphql}"
  export DID_MANAGER_PREPROD_INDEXER_WS="${DID_MANAGER_PREPROD_INDEXER_WS:-wss://indexer.preprod.midnight.network/api/v3/graphql/ws}"
  export DID_MANAGER_PREPROD_NODE="${DID_MANAGER_PREPROD_NODE:-https://rpc.preprod.midnight.network}"
  export DID_MANAGER_PREPROD_PROOF_SERVER="${DID_MANAGER_PREPROD_PROOF_SERVER:-http://127.0.0.1:6300}"
  export START_PREPROD_PROOF_SERVER="${START_PREPROD_PROOF_SERVER:-true}"

  if [[ "${START_PREPROD_PROOF_SERVER}" == "true" && "${DID_MANAGER_PREPROD_PROOF_SERVER}" == "http://127.0.0.1:6300" ]]; then
    echo "[start-manager] Starting local preprod proof server"
    docker compose -f cli/proof-server.yml up -d proof-server
    wait_for_proof_server
  fi

  echo "[start-manager] Starting did-manager-service in preprod mode"
  echo "[start-manager] Preprod indexer: ${DID_MANAGER_PREPROD_INDEXER}"
  echo "[start-manager] Preprod node: ${DID_MANAGER_PREPROD_NODE}"
  echo "[start-manager] Proof server: ${DID_MANAGER_PREPROD_PROOF_SERVER}"
  echo "[start-manager] Open http://${DID_MANAGER_HOST}:${DID_MANAGER_PORT}/wallet"
fi

npm run dev -w did-manager-service
