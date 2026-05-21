#!/usr/bin/env bash
set -euo pipefail

source ./scripts/run-common.sh

run_common_setup_cleanup_trap
run_common_ensure_node
run_common_ensure_runtime_helpers
run_common_ensure_contract_artifacts "api"

echo "[api] Build dependencies"
npm run build:service-prereqs

echo "[api] Build API"
npm run build -w ./packages/api

echo "[api] Typecheck API examples"
npm run typecheck:examples -w ./packages/api

echo "[api] Run API unit tests"
npm run test -w ./packages/api

if [[ "${SKIP_LONG_RUNNING:-0}" == "1" ]]; then
  echo "[api] Skip API integration tests (SKIP_LONG_RUNNING=1)"
else
  echo "[api] Run API integration tests"
  npm run test-api -w ./packages/api
fi

echo "[api] Done"
