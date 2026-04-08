#!/usr/bin/env bash
set -euo pipefail

source ./scripts/run-common.sh

run_common_setup_cleanup_trap
run_common_ensure_node
run_common_auto_proof_server_image "manager"

export DID_MANAGER_SETUP="${DID_MANAGER_SETUP:-standalone}"

run_common_ensure_contract_artifacts "manager"

echo "[manager] Build dependency packages (once)"
npm run prepare:deps -w did-manager-service

echo "[manager] Lint"
npm run lint -w did-manager-service

echo "[manager] Build"
npm --ignore-scripts run build -w did-manager-service

echo "[manager] Test"
npm --ignore-scripts run test -w did-manager-service

if [[ "${SKIP_LONG_RUNNING:-0}" == "1" ]]; then
  echo "[manager] Skip Playwright E2E (SKIP_LONG_RUNNING=1)"
else
  if [[ -n "${PLAYWRIGHT_BROWSERS_PATH:-}" && -d "${PLAYWRIGHT_BROWSERS_PATH}" ]]; then
    echo "[manager] Skip Playwright install (PLAYWRIGHT_BROWSERS_PATH set and exists: ${PLAYWRIGHT_BROWSERS_PATH})"
  else
    echo "[manager] Playwright install"
    npm run playwright:install -w did-manager-service
  fi

  echo "[manager] Playwright E2E (standalone)"
  npm run test:e2e:standalone -w did-manager-service
fi

echo "[manager] Done"
