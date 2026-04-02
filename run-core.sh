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

if [[ "${SKIP_LINT_FIX:-0}" == "1" ]]; then
  echo "[core] Skip lint auto-fix (SKIP_LINT_FIX=1)"
else
  echo "[core] Lint (fix)"
  npm run lint:fix || true
fi

echo "[core] Lint"
npm run lint

echo "[core] Contract build/test"
npm run contract -w contract
npm run build -w contract
SKIP_RUNTIME_TESTS=1 npm run test:ci -w contract || SKIP_RUNTIME_TESTS=1 npm run test -w contract
npm run coverage -w contract || true

echo "[core] Domain build/test"
npm run build -w domain
npm run test -w domain
npm run coverage -w domain || true

echo "[core] DID build/test"
npm run build -w did
npm run test -w did -- --pool=threads
npm run coverage -w did || true

echo "[core] Secret storage build/test"
npm run build -w secret-storage
npm run test -w secret-storage
npm run coverage -w secret-storage || true

echo "[core] Done"
