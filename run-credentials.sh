#!/usr/bin/env bash
set -euo pipefail

source ./scripts/run-common.sh

run_common_setup_cleanup_trap
run_common_ensure_node
run_common_ensure_runtime_helpers

echo "[credentials] Lint"
npm run lint -w credentials
npm run lint -w credentials-same-holder
npm run lint -w credentials-birth
npm run lint -w credentials-birth-secret
npm run lint -w credentials-demo-contract

echo "[credentials] Typecheck"
npm run typecheck -w credentials
npm run typecheck -w credentials-same-holder
npm run typecheck -w credentials-birth
npm run typecheck -w credentials-birth-secret
npm run typecheck -w credentials-demo-contract

echo "[credentials] Core credentials package"
npm run all -w credentials

echo "[credentials] Same-holder capability package"
npm run all -w credentials-same-holder

echo "[credentials] Birth credential family"
npm run all -w credentials-birth

echo "[credentials] Secret birth credential family"
npm run all -w credentials-birth-secret

echo "[credentials] Demo verifier contract"
npm run all -w credentials-demo-contract

if docker info >/dev/null 2>&1; then
  echo "[credentials] Standalone protocol integration"
  npm run test:integration -w credentials-demo-contract
else
  echo "[credentials] Skipping standalone protocol integration (docker unavailable)"
fi

echo "[credentials] Done"
