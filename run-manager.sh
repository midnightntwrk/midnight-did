#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  ./scripts/cleanup-test-infra.sh || true
}

cleanup
trap cleanup EXIT INT TERM

node ./scripts/ensure-node-24.mjs

export DID_MANAGER_SETUP="${DID_MANAGER_SETUP:-standalone}"

if [[ ! -f "contract/src/managed/did/contract/index.js" ]]; then
  echo "[manager] Generate contract managed artifacts"
  npm run contract -w contract
fi

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
