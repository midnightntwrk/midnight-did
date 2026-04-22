#!/usr/bin/env bash
set -euo pipefail

source ./scripts/run-common.sh

run_common_setup_cleanup_trap
run_common_ensure_node
run_common_ensure_runtime_helpers

run_passport_integration_target() {
  local label="$1"
  shift

  run_common_cleanup_test_infra
  echo "[passport-prototype] ${label}"
  "$@"
  run_common_cleanup_test_infra
}

echo "[passport-prototype] Lint"
npm run lint -w midnight-passport-prototype
node --check midnight-passport-prototype/app/app.js
node --check midnight-passport-prototype/app/national-id-issuer.js

echo "[passport-prototype] Package and app tests"
npm run all -w midnight-passport-prototype

echo "[passport-prototype] Browser e2e"
npm run test:e2e -w midnight-passport-prototype

if docker info >/dev/null 2>&1; then
  run_passport_integration_target \
    "Standalone passport integration" \
    npm run test:integration -w @midnight-ntwrk/midnight-did-credentials-passport
  run_passport_integration_target \
    "Standalone secret passport integration" \
    npm run test:integration -w @midnight-ntwrk/midnight-did-credentials-passport-secret
else
  echo "[passport-prototype] Skipping standalone integrations (docker unavailable)"
fi

echo "[passport-prototype] Done"
