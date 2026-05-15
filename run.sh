#!/usr/bin/env bash
set -euo pipefail

source ./scripts/run-common.sh

run_common_parse_args "run" "$@"

if [[ "${RUN_COMMON_DRY_RUN}" != "1" ]]; then
  run_common_setup_cleanup_trap
  run_common_ensure_node
  run_common_ensure_runtime_helpers
  run_common_auto_proof_server_image "run"
fi

if [[ "${SKIP_LONG_RUNNING:-0}" == "1" ]]; then
  echo "[run] Fast mode enabled: long-running integration/UI targets will be skipped"
fi

run_common_run_step "Core pipeline" ./run-core.sh

run_common_run_step "API pipeline" ./run-api.sh

run_common_run_step "Resolver pipeline" ./run-resolver.sh

run_common_run_step "DID manager pipeline" ./run-manager.sh

echo "All steps completed successfully."
run_common_finish
