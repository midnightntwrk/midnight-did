#!/usr/bin/env bash

if [[ -n "${MIDNIGHT_RUN_COMMON_SH_LOADED:-}" ]]; then
  return 0
fi
MIDNIGHT_RUN_COMMON_SH_LOADED=1

RUN_COMMON_PRINT_METRICS=0
RUN_COMMON_METRICS_JSON_PATH=""
RUN_COMMON_SCRIPT_NAME="run"
RUN_COMMON_TARGET="full"
RUN_COMMON_LIGHT_REQUESTED=0
RUN_COMMON_STRICT_REQUESTED=0
RUN_COMMON_DRY_RUN="${MIDNIGHT_DID_DRY_RUN:-0}"
# Top-level runner state only; subprocess lane scripts are not aggregated.
RUN_COMMON_STEP_LABELS=()
RUN_COMMON_STEP_DURATIONS=()

run_common_catalog() {
  node ./scripts/run-target-catalog.mjs "$@"
}

run_common_usage() {
  local script_name="${1:-run}"
  cat <<EOF
Usage: ./${script_name}.sh [target] [--light] [--strict] [--metrics] [--metrics-json <file>] [--skip-coverage] [-h|--help]

Target defaults to 'full'.

Options:
  --light         Skip long-running integration/UI targets.
  --strict        Do not run lint auto-fix in lanes that support it.
  --metrics       Print per-step wall-clock durations.
  --metrics-json  Export per-step timings as JSON.
  --skip-coverage Accepted for compatibility with older local workflows.
  -h, --help      Show this help text.

EOF
  run_common_catalog --targets
}

run_common_target_exists() {
  local target="$1"
  run_common_catalog --has-target "${target}" >/dev/null 2>&1
}

run_common_target_supports_light() {
  local target="$1"
  run_common_catalog --supports-light "${target}" >/dev/null 2>&1
}

run_common_target_supports_strict() {
  local target="$1"
  run_common_catalog --supports-strict "${target}" >/dev/null 2>&1
}

run_common_warn_unsupported_flags() {
  local target="$1"

  if [[ "${RUN_COMMON_LIGHT_REQUESTED}" == "1" ]] && ! run_common_target_supports_light "${target}"; then
    echo "[${RUN_COMMON_SCRIPT_NAME}] Warning: --light is ignored by target '${target}'" >&2
  fi

  if [[ "${RUN_COMMON_STRICT_REQUESTED}" == "1" ]] && ! run_common_target_supports_strict "${target}"; then
    echo "[${RUN_COMMON_SCRIPT_NAME}] Warning: --strict is ignored by target '${target}'" >&2
  fi
}

run_common_parse_args() {
  RUN_COMMON_SCRIPT_NAME="${1:-run}"
  shift || true

  if [[ $# -gt 0 && "$1" != -* ]]; then
    if run_common_target_exists "$1"; then
      RUN_COMMON_TARGET="$1"
      shift
    else
      echo "Unknown target: $1" >&2
      run_common_usage "${RUN_COMMON_SCRIPT_NAME}" >&2
      return 1
    fi
  fi

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --light)
        RUN_COMMON_LIGHT_REQUESTED=1
        export SKIP_LONG_RUNNING=1
        shift
        ;;
      --strict)
        RUN_COMMON_STRICT_REQUESTED=1
        export SKIP_LINT_FIX=1
        shift
        ;;
      --metrics)
        RUN_COMMON_PRINT_METRICS=1
        shift
        ;;
      --metrics-json)
        if [[ $# -lt 2 ]]; then
          echo "--metrics-json requires a file path." >&2
          return 1
        fi
        shift
        if [[ "$1" == -* ]]; then
          echo "--metrics-json requires a file path." >&2
          return 1
        fi
        RUN_COMMON_METRICS_JSON_PATH="$1"
        shift
        ;;
      --skip-coverage)
        # Compatibility stub for older local workflows; current split lanes do
        # not run coverage targets.
        export SKIP_COVERAGE=1
        shift
        ;;
      -h|--help)
        run_common_usage "${RUN_COMMON_SCRIPT_NAME}"
        exit 0
        ;;
      *)
        echo "Unknown argument: $1" >&2
        run_common_usage "${RUN_COMMON_SCRIPT_NAME}" >&2
        return 1
        ;;
    esac
  done
}

run_common_cleanup_test_infra() {
  ./scripts/cleanup-test-infra.sh || true
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
  if [[ ! -f "packages/contract/dist/managed/did/contract/index.js" ]]; then
    echo "[${caller}] Build contract package outputs"
    pnpm --filter ./packages/contract build:prepared
  fi
}

run_common_now_ms() {
  # Use Node for portable millisecond timestamps across macOS and Linux shells.
  node -e 'process.stdout.write(String(Date.now()))'
}

run_common_json_escape() {
  local value=$1
  value=${value//\\/\\\\}
  value=${value//\"/\\\"}
  value=${value//$'\n'/\\n}
  value=${value//$'\r'/\\r}
  value=${value//$'\t'/\\t}
  printf '%s' "$value"
}

run_common_json_bool() {
  case "${1:-0}" in
    1|true|TRUE|yes|YES|on|ON)
      printf 'true'
      ;;
    *)
      printf 'false'
      ;;
  esac
}

run_common_run_step() {
  local label="$1"
  shift

  local start_ms
  local end_ms
  local elapsed_ms
  local rc=0

  echo "[${RUN_COMMON_SCRIPT_NAME}] ${label}"
  start_ms=$(run_common_now_ms)

  if [[ "${RUN_COMMON_DRY_RUN}" == "1" ]]; then
    printf 'DRY-RUN:'
    printf ' %q' "$@"
    printf '\n'
    elapsed_ms=0
  else
    "$@" || rc=$?
    end_ms=$(run_common_now_ms)
    elapsed_ms=$((end_ms - start_ms))
  fi

  RUN_COMMON_STEP_LABELS+=("${label}")
  RUN_COMMON_STEP_DURATIONS+=("${elapsed_ms}")

  if [[ "${RUN_COMMON_PRINT_METRICS}" == "1" ]]; then
    printf "  step %03d: %8dms\n" "${#RUN_COMMON_STEP_LABELS[@]}" "${elapsed_ms}"
  fi

  if [[ "${rc}" != "0" ]]; then
    echo "[${RUN_COMMON_SCRIPT_NAME}] Step failed after ${elapsed_ms}ms: ${label}" >&2
    run_common_write_metrics_json
    return "${rc}"
  fi
}

run_common_write_metrics_json() {
  local metrics_path="${RUN_COMMON_METRICS_JSON_PATH}"
  local metrics_dir

  if [[ -z "${metrics_path}" ]]; then
    return 0
  fi

  metrics_dir="$(dirname "${metrics_path}")"
  if [[ -n "${metrics_dir}" && "${metrics_dir}" != "." && ! -d "${metrics_dir}" ]]; then
    mkdir -p "${metrics_dir}"
  fi

  {
    printf '{\n'
    printf '  "generatedAt": "%s",\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf '  "script": "%s",\n' "$(run_common_json_escape "${RUN_COMMON_SCRIPT_NAME}")"
    printf '  "totalSteps": %d,\n' "${#RUN_COMMON_STEP_LABELS[@]}"
    printf '  "lightMode": %s,\n' "$(run_common_json_bool "${SKIP_LONG_RUNNING:-0}")"
    printf '  "strictMode": %s,\n' "$(run_common_json_bool "${SKIP_LINT_FIX:-0}")"
    printf '  "skipCoverage": %s,\n' "$(run_common_json_bool "${SKIP_COVERAGE:-0}")"
    printf '  "printMetrics": %s,\n' "$(run_common_json_bool "${RUN_COMMON_PRINT_METRICS}")"
    printf '  "steps": [\n'
    local i
    for i in "${!RUN_COMMON_STEP_LABELS[@]}"; do
      if ((i > 0)); then
        printf ',\n'
      fi
      printf '    {"index": %d, "label": "%s", "durationMs": %s}' \
        "$((i + 1))" \
        "$(run_common_json_escape "${RUN_COMMON_STEP_LABELS[$i]}")" \
        "${RUN_COMMON_STEP_DURATIONS[$i]:-0}"
    done
    printf '\n  ]\n'
    printf '}\n'
  } >"${metrics_path}"

  echo "[${RUN_COMMON_SCRIPT_NAME}] Metrics JSON written to: ${metrics_path}"
}

run_common_finish() {
  if [[ "${RUN_COMMON_PRINT_METRICS}" == "1" ]]; then
    printf "\n[%s] Step timing summary (ms):\n" "${RUN_COMMON_SCRIPT_NAME}"
    local i
    for i in "${!RUN_COMMON_STEP_LABELS[@]}"; do
      printf "  %03d  %-32s %12s\n" \
        "$((i + 1))" \
        "${RUN_COMMON_STEP_LABELS[$i]}" \
        "${RUN_COMMON_STEP_DURATIONS[$i]:-0}"
    done
  fi

  run_common_write_metrics_json
}
