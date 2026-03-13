#!/usr/bin/env bash
set -euo pipefail

node ./scripts/ensure-node-24.mjs

export DID_MANAGER_SETUP="${DID_MANAGER_SETUP:-preprod}"

export DID_MANAGER_PREPROD_INDEXER="${DID_MANAGER_PREPROD_INDEXER:-https://indexer.preprod.midnight.network/api/v3/graphql}"
export DID_MANAGER_PREPROD_INDEXER_WS="${DID_MANAGER_PREPROD_INDEXER_WS:-wss://indexer.preprod.midnight.network/api/v3/graphql/ws}"
export DID_MANAGER_PREPROD_NODE="${DID_MANAGER_PREPROD_NODE:-https://rpc.preprod.midnight.network}"
export DID_MANAGER_PREPROD_PROOF_SERVER="${DID_MANAGER_PREPROD_PROOF_SERVER:-http://127.0.0.1:6300}"
export START_PREPROD_PROOF_SERVER="${START_PREPROD_PROOF_SERVER:-true}"

wait_for_proof_server() {
  local deadline=$((SECONDS + 180))
  until curl -fsS "${DID_MANAGER_PREPROD_PROOF_SERVER}/version" >/dev/null 2>&1; do
    if (( SECONDS >= deadline )); then
      echo "[manager-preprod] Proof server did not become ready at ${DID_MANAGER_PREPROD_PROOF_SERVER}" >&2
      exit 1
    fi
    sleep 2
  done
}

if [[ "${START_PREPROD_PROOF_SERVER}" == "true" && "${DID_MANAGER_PREPROD_PROOF_SERVER}" == "http://127.0.0.1:6300" ]]; then
  echo "[manager-preprod] Starting local preprod proof server"
  docker compose -f cli/proof-server.yml up -d proof-server
  wait_for_proof_server
fi

echo "[manager-preprod] Starting did-manager-service in preprod mode"
echo "[manager-preprod] Preprod indexer: ${DID_MANAGER_PREPROD_INDEXER}"
echo "[manager-preprod] Preprod node: ${DID_MANAGER_PREPROD_NODE}"
echo "[manager-preprod] Proof server: ${DID_MANAGER_PREPROD_PROOF_SERVER}"
echo "[manager-preprod] Open http://127.0.0.1:3010/wallet"

npm run dev -w did-manager-service
