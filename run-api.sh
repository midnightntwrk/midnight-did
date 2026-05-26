#!/usr/bin/env bash
set -euo pipefail

source ./scripts/run-common.sh

run_common_setup_cleanup_trap
run_common_ensure_node
run_common_ensure_runtime_helpers
run_common_ensure_contract_artifacts "api"

echo "[api] Build dependencies"
pnpm run build:api-prereqs

echo "[api] Build API"
pnpm --filter ./packages/api build

echo "[api] Typecheck API examples"
pnpm --filter ./packages/api typecheck:examples

echo "[api] Check API source import discipline"
pnpm run check:api-source-imports

echo "[api] Run API unit tests"
pnpm --filter ./packages/api test

if [[ "${SKIP_LONG_RUNNING:-0}" == "1" ]]; then
  echo "[api] Skip API integration tests (SKIP_LONG_RUNNING=1)"
else
  echo "[api] Run API integration tests"
  pnpm --filter ./packages/api test-api
fi

echo "[api] Done"
