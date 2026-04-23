#!/usr/bin/env bash
set -euo pipefail

source ./scripts/run-common.sh

run_common_apply_light_mode "$@"
run_common_setup_cleanup_trap
run_common_ensure_node
run_common_ensure_runtime_helpers
run_common_auto_proof_server_image "resolver"
run_common_ensure_contract_artifacts "resolver"

echo "[resolver] Build dependencies"
npm run build -w contract
npm run build -w domain
npm run build -w did
npm run build -w secret-storage
npm run build -w api

echo "[resolver] Lint + build"
npm run lint -w did-resolver-service
npm run build -w did-resolver-service

echo "[resolver] Run resolver unit tests"
npm run test -w did-resolver-service

if [[ "${SKIP_LONG_RUNNING:-0}" == "1" ]]; then
  echo "[resolver] Skip resolver integration tests (SKIP_LONG_RUNNING=1)"
else
  echo "[resolver] Run resolver integration tests"
  npm run test:integration -w did-resolver-service
fi

echo "[resolver] Done"
