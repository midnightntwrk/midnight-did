#!/usr/bin/env bash
set -euo pipefail

source ./scripts/run-common.sh

run_common_setup_cleanup_trap
run_common_ensure_node
run_common_ensure_runtime_helpers
run_common_auto_proof_server_image "credentials"

run_credentials_integration_target() {
  local label="$1"
  shift

  run_common_cleanup_test_infra
  echo "[credentials] ${label}"
  "$@"
  run_common_cleanup_test_infra
}

echo "[credentials] Lint"
npm run lint -w credentials
npm run lint -w credentials-same-holder
npm run lint -w credentials-iso-registry
npm run lint -w credentials-birth
npm run lint -w credentials-birth-secret
npm run lint -w credentials-passport
npm run lint -w credentials-passport-secret
npm run lint -w credentials-demo-contract
npm run lint -w credentials-protocol

echo "[credentials] Typecheck"
npm run typecheck -w credentials
npm run typecheck -w credentials-same-holder
npm run typecheck -w credentials-iso-registry
npm run typecheck -w credentials-birth
npm run typecheck -w credentials-birth-secret
npm run typecheck -w credentials-passport
npm run typecheck -w credentials-passport-secret
npm run typecheck -w credentials-demo-contract
npm run typecheck -w credentials-protocol
npm run typecheck -w standalone-environment

echo "[credentials] Core credentials package"
npm run all -w credentials

echo "[credentials] Same-holder capability package"
npm run all -w credentials-same-holder

echo "[credentials] ISO registry package"
npm run all -w credentials-iso-registry

echo "[credentials] Birth credential family"
npm run all -w credentials-birth

echo "[credentials] Secret birth credential family"
npm run all -w credentials-birth-secret

echo "[credentials] Passport credential family"
npm run all -w credentials-passport

echo "[credentials] Secret passport credential family"
npm run all -w credentials-passport-secret

echo "[credentials] Demo verifier contract"
npm run all -w credentials-demo-contract

echo "[credentials] Protocol simulation layer"
npm run all -w credentials-protocol

if docker info >/dev/null 2>&1; then
  run_credentials_integration_target \
    "Standalone demo-contract integration" \
    npm run test:integration -w credentials-demo-contract
  run_credentials_integration_target \
    "Standalone passport integration" \
    npm run test:integration -w credentials-passport
  run_credentials_integration_target \
    "Standalone secret passport integration" \
    npm run test:integration -w credentials-passport-secret
  run_credentials_integration_target \
    "Standalone protocol integration" \
    npm run test:integration -w credentials-protocol
else
  echo "[credentials] Skipping standalone integrations (docker unavailable)"
fi

echo "[credentials] Done"
