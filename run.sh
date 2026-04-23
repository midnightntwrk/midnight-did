#!/usr/bin/env bash
set -euo pipefail

source ./scripts/run-common.sh

run_common_apply_light_mode "$@"
run_common_setup_cleanup_trap
run_common_ensure_node
run_common_ensure_runtime_helpers
run_common_auto_proof_server_image "run"

if [[ "${SKIP_LONG_RUNNING:-0}" == "1" ]]; then
  echo "[run] Fast mode enabled: long-running integration/UI targets will be skipped"
fi

echo "[all] Core pipeline"
./run-core.sh

echo "[all] API pipeline"
./run-api.sh

echo "[all] Resolver pipeline"
./run-resolver.sh

echo "[all] DID manager pipeline"
./run-manager.sh

echo "[all] Credentials pipeline"
./run-credentials.sh

echo "[all] Midnight Passport prototype pipeline"
./run-passport-prototype.sh

echo "All steps completed successfully."
