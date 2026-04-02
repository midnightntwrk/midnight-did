#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  ./scripts/cleanup-test-infra.sh || true
}

cleanup
trap cleanup EXIT INT TERM

node ./scripts/ensure-node-24.mjs
node ./scripts/ensure-onchain-runtime-cjs.mjs
node ./scripts/ensure-rollup-native.mjs

if [[ ! -f "contract/src/managed/did/contract/index.js" ]]; then
  echo "[resolver] Generate contract managed artifacts"
  npm run contract -w contract
fi

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
