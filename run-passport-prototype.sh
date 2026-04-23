#!/usr/bin/env bash
set -euo pipefail

source ./scripts/run-common.sh

run_common_apply_light_mode "$@"
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

if [[ "${SKIP_LONG_RUNNING:-0}" == "1" ]]; then
  echo "[passport-prototype] Skip browser e2e (SKIP_LONG_RUNNING=1)"
elif [[ -n "${PLAYWRIGHT_BROWSERS_PATH:-}" && -d "${PLAYWRIGHT_BROWSERS_PATH}" ]]; then
  echo "[passport-prototype] Skip Playwright install (PLAYWRIGHT_BROWSERS_PATH set and exists: ${PLAYWRIGHT_BROWSERS_PATH})"
  echo "[passport-prototype] Browser e2e"
  npm run test:e2e -w midnight-passport-prototype
else
  echo "[passport-prototype] Browser e2e"
  npm run test:e2e -w midnight-passport-prototype
fi

if [[ "${SKIP_LONG_RUNNING:-0}" == "1" ]]; then
  echo "[passport-prototype] Skip standalone integrations (SKIP_LONG_RUNNING=1)"
elif docker info >/dev/null 2>&1; then
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
