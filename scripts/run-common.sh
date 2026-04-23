#!/usr/bin/env bash

if [[ -n "${MIDNIGHT_RUN_COMMON_SH_LOADED:-}" ]]; then
  return 0
fi
MIDNIGHT_RUN_COMMON_SH_LOADED=1

run_common_cleanup_test_infra() {
  ./scripts/cleanup-test-infra.sh || true
}

run_common_apply_light_mode() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      --light)
        export SKIP_LONG_RUNNING=1
        ;;
    esac
  done
}

run_common_setup_cleanup_trap() {
  run_common_cleanup_test_infra
  trap 'run_common_cleanup_test_infra' EXIT INT TERM
}

run_common_ensure_node() {
  node ./scripts/ensure-node-24.mjs
}

run_common_ensure_runtime_helpers() {
  node ./scripts/ensure-onchain-runtime-cjs.mjs
  node ./scripts/ensure-rollup-native.mjs
}

run_common_auto_proof_server_image() {
  local caller="${1:-run}"
  if [[ -z "${PROOF_SERVER_IMAGE:-}" ]] \
    && command -v docker >/dev/null 2>&1 \
    && docker image inspect proof-server-bootstrap:8.0.3 >/dev/null 2>&1; then
    export PROOF_SERVER_IMAGE="proof-server-bootstrap:8.0.3"
    echo "[${caller}] Using local bootstrapped proof server image: ${PROOF_SERVER_IMAGE}"
  fi
}

run_common_ensure_contract_artifacts() {
  local caller="${1:-run}"
  if [[ ! -f "contract/src/managed/did/contract/index.js" ]]; then
    echo "[${caller}] Generate contract managed artifacts"
    npm run contract -w contract
  fi
}
