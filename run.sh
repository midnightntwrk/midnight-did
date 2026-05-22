#!/usr/bin/env bash
set -euo pipefail

source ./scripts/run-common.sh

run_common_parse_args "run" "$@"
run_common_warn_unsupported_flags "${RUN_COMMON_TARGET}"

case "${RUN_COMMON_TARGET}" in
  targets|help)
    run_common_usage "run"
    exit 0
    ;;
  clean-artifacts)
    run_common_ensure_node
    node ./scripts/clean-artifacts.mjs
    exit 0
    ;;
  artifact-status)
    run_common_ensure_node
    node ./scripts/managed-artifact-catalog.mjs --json
    exit 0
    ;;
  check-managed-artifacts)
    run_common_ensure_node
    node ./scripts/managed-artifact-catalog.mjs --check
    exit 0
    ;;
  integration-report)
    run_common_ensure_node
    node ./scripts/report-integration.mjs
    exit 0
    ;;
  check-integration)
    run_common_ensure_node
    node ./scripts/report-integration.mjs --check
    exit 0
    ;;
esac

run_catalog_steps() {
  local target_name="$1"
  local labels=()
  local commands=()
  local line
  local i

  while IFS= read -r line; do
    if [[ -n "${line}" ]]; then
      labels+=("${line}")
    fi
  done < <(run_common_catalog --step-labels "${target_name}")

  while IFS= read -r line; do
    if [[ -n "${line}" ]]; then
      commands+=("${line}")
    fi
  done < <(run_common_catalog --step-commands "${target_name}")

  if [[ "${#labels[@]}" == "0" || "${#labels[@]}" != "${#commands[@]}" ]]; then
    echo "[run] No executable runner steps found for target '${target_name}'" >&2
    exit 1
  fi

  for i in "${!labels[@]}"; do
    run_common_run_step "${labels[$i]}" "${commands[$i]}"
  done
}

case "${RUN_COMMON_TARGET}" in
  docs)
    # Docs builds do not touch Docker, proof-server, or generated runtime shims.
    # Skip infra setup so docs-only CI and local previews stay fast.
    if [[ "${RUN_COMMON_DRY_RUN}" != "1" ]]; then
      run_common_ensure_node
    fi
    run_catalog_steps "${RUN_COMMON_TARGET}"
    echo "All steps completed successfully."
    run_common_finish
    exit 0
    ;;
esac

if [[ "${RUN_COMMON_DRY_RUN}" != "1" ]]; then
  run_common_setup_cleanup_trap
  run_common_ensure_node
  run_common_ensure_runtime_helpers
  run_common_auto_proof_server_image "run"
fi

if [[ "${SKIP_LONG_RUNNING:-0}" == "1" ]]; then
  echo "[run] Fast mode enabled: long-running integration/UI targets will be skipped"
fi

run_catalog_steps "${RUN_COMMON_TARGET}"

echo "All steps completed successfully."
run_common_finish
