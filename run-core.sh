#!/usr/bin/env bash
set -euo pipefail

source ./scripts/run-common.sh

run_common_setup_cleanup_trap
run_common_ensure_node
run_common_ensure_runtime_helpers

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
