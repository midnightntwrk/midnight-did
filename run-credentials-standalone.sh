#!/usr/bin/env bash
set -euo pipefail

source ./scripts/run-common.sh

run_common_setup_cleanup_trap
run_common_ensure_node
run_common_ensure_runtime_helpers
run_common_auto_proof_server_image "credentials-standalone"

if ! docker info >/dev/null 2>&1; then
  echo "[credentials-standalone] Docker is required for standalone Midnight VC validation"
  exit 1
fi

echo "[credentials-standalone] Demo verifier contract integration"
npm run test:integration -w credentials-demo-contract

echo "[credentials-standalone] Explicit passport integration"
npm run test:integration -w credentials-passport

echo "[credentials-standalone] Secret passport integration"
npm run test:integration -w credentials-passport-secret

echo "[credentials-standalone] Birth protocol integration"
npm run test:integration -w credentials-protocol

echo "[credentials-standalone] Done"
