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

echo "[core] Turbo-aware core lane"
npm run ci:core

echo "[core] Done"
