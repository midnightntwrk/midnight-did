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

echo "[cli] Build dependencies"
npm run build -w contract
npm run build -w domain
npm run build -w did
npm run build -w api
npm run build -w secret-storage

echo "[cli] Lint + typecheck"
npm run lint -w cli
npm run typecheck -w cli

echo "[cli] Build CLI"
npm run build -w cli

echo "[cli] Run CLI API/unit tests (independent from api/resolver suites)"
npm run test:cli-api -w cli

echo "[cli] Done"
