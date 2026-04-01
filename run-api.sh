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

echo "[api] Build dependencies"
npm run build -w contract
npm run build -w domain
npm run build -w did

echo "[api] Build API"
npm run build -w api

echo "[api] Run API unit tests"
npm run test -w api

if [[ "${SKIP_LONG_RUNNING:-0}" == "1" ]]; then
  echo "[api] Skip API integration tests (SKIP_LONG_RUNNING=1)"
else
  echo "[api] Run API integration tests"
  npm run test-api -w api
fi

echo "[api] Done"
