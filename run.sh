#!/usr/bin/env bash
set -euo pipefail

STRICT_MODE=0
PRINT_METRICS=0
SKIP_COVERAGE=0
METRICS_JSON_PATH=""
DRY_RUN="${MIDNIGHT_DID_DRY_RUN:-0}"

usage() {
  cat <<'EOF'
Usage: ./run.sh [--strict] [--metrics] [--skip-coverage] [--metrics-json <file>] [-h|--help]

Runs the full local pipeline.

Options:
  --strict        Do not run lint:fix; fail if lint is not clean.
  --metrics       Print per-step wall-clock durations.
  --skip-coverage Skip all coverage steps (faster local runs).
  --metrics-json  Export timings as JSON. Requires a destination path:
                  --metrics-json <path/to/metrics.json>
  -h, --help      Show this help text.

Useful follow-up commands:
  npm run pr:snippet -- --metrics <metrics.json> --command "bash ./run.sh --skip-coverage" --verdict pass
  npm run university-bdd:visualize -- --out /tmp/university-bdd-replay.html
  npm run university-bdd:metrics -- --format markdown

Reference docs:
  docs/midnight-did-book-for-dummies.md#university-flow-documentation-bundle
  docs/uc-bundles/university-bdd/README.md
  docs/repository-maturity-backlog.md
EOF
}

while (($#)); do
  case "${1:-}" in
    --strict)
      STRICT_MODE=1
      ;;
    --metrics)
      PRINT_METRICS=1
      ;;
    --skip-coverage)
      SKIP_COVERAGE=1
      ;;
    --metrics-json)
      if (($# < 2)); then
        echo "--metrics-json requires a file path." >&2
        exit 1
      fi
      shift
      METRICS_JSON_PATH=$1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: ${1}" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

if [[ "$DRY_RUN" != "1" ]]; then
  node ./scripts/check-workspace-dependencies.mjs
  node ./scripts/check-toolchain.mjs
  node ./scripts/ensure-onchain-runtime-cjs.mjs
fi

declare -a STEP_LABELS=()
declare -a STEP_COMMANDS=()
declare -a STEP_DURATIONS=()

add_step() {
  STEP_LABELS+=("$1")
  STEP_COMMANDS+=("$2")
}

now_ms() {
  node -e 'process.stdout.write(String(Date.now()))'
}

json_escape() {
  local value=$1
  value=${value//\\/\\\\}
  value=${value//\"/\\\"}
  value=${value//$'\n'/\\n}
  value=${value//$'\r'/\\r}
  value=${value//$'\t'/\\t}
  printf '%s' "$value"
}

run_step() {
  local index=$1
  local label=$2
  local command=$3

  local total_steps=${#STEP_LABELS[@]}
  local display_step=$((index + 1))

  echo "[${display_step}/${total_steps}] ${label}"

  local start_ms
  local end_ms
  local elapsed_ms
  start_ms=$(now_ms)

  if ! bash -lc "$command"; then
    end_ms=$(now_ms)
    elapsed_ms=$((end_ms - start_ms))
    echo "Step failed after ${elapsed_ms}ms: ${label}" >&2
    exit 1
  fi

  end_ms=$(now_ms)
  elapsed_ms=$((end_ms - start_ms))
  STEP_DURATIONS+=("$elapsed_ms")

  if [[ "$PRINT_METRICS" == "1" ]]; then
    printf "  step %03d: %8dms\n" "$display_step" "$elapsed_ms"
  fi
}

write_metrics_json() {
  local total_steps=${#STEP_LABELS[@]}
  local metrics_dir
  metrics_dir="$(dirname "${METRICS_JSON_PATH}")"
  if [[ -n "${metrics_dir}" && "${metrics_dir}" != "." && ! -d "${metrics_dir}" ]]; then
    mkdir -p "${metrics_dir}"
  fi

  {
    printf '{\n'
    printf '  "generatedAt": "%s",\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf '  "totalSteps": %d,\n' "${total_steps}"
    printf '  "strictMode": %s,\n' "${STRICT_MODE}"
    printf '  "skipCoverage": %s,\n' "${SKIP_COVERAGE}"
    printf '  "printMetrics": %s,\n' "${PRINT_METRICS}"
    printf '  "steps": [\n'
    local i=0
    local label
    local duration
    for i in "${!STEP_LABELS[@]}"; do
      local step_index=$((i + 1))
      local escaped_label
      duration="${STEP_DURATIONS[$i]:-0}"
      label="${STEP_LABELS[$i]}"
      escaped_label="$(json_escape "$label")"
      if ((i > 0)); then
        printf ',\n'
      fi
      printf '    {"index": %d, "label": "%s", "durationMs": %s}' "${step_index}" "${escaped_label}" "${duration}"
    done
    printf '\n  ]\n'
    printf '}\n'
  } >"${METRICS_JSON_PATH}"
  echo "Metrics JSON written to: ${METRICS_JSON_PATH}"
}

if [[ "$STRICT_MODE" == "1" ]]; then
  add_step "Lint workspaces" "npm run lint"
else
  add_step "Lint (fix) workspaces" "npm run lint:fix || true"
  add_step "Lint workspaces" "npm run lint"
fi

add_step "Build contract (compact)" "npm run contract -w contract"
add_step "Build contract (tsc)" "npm run build -w contract"
add_step "Test contract" "SKIP_RUNTIME_TESTS=1 npm run test:ci -w contract || SKIP_RUNTIME_TESTS=1 npm run test -w contract"

if [[ "$SKIP_COVERAGE" == "0" ]]; then
  add_step "Coverage contract" "npm run coverage -w contract"
fi

add_step "Build domain" "npm run build -w domain"
add_step "Test domain" "npm run test -w domain"

if [[ "$SKIP_COVERAGE" == "0" ]]; then
  add_step "Coverage domain" "npm run coverage -w domain"
fi

add_step "Build did" "npm run build -w did"
add_step "Test did" "npm run test -w did -- --pool=threads"

if [[ "$SKIP_COVERAGE" == "0" ]]; then
  add_step "Coverage did" "npm run coverage -w did"
fi

add_step "Build API and run tests" "npm run build -w api && npm run test -w api && npm run test-api -w api"

if [[ "$SKIP_COVERAGE" == "0" ]]; then
  add_step "Coverage API" "npm run coverage -w api"
fi

add_step "Build CLI" "npm run build -w cli"

add_step "Build and test DID resolver service" "npm run build -w did-resolver-service && npm run test -w did-resolver-service && npm run test:integration -w did-resolver-service"

if [[ "$SKIP_COVERAGE" == "0" ]]; then
  add_step "Coverage DID resolver service" "npm run coverage -w did-resolver-service"
fi

if [[ "$DRY_RUN" == "1" ]]; then
  echo "DRY-RUN: planned steps:"
  for step_index in "${!STEP_LABELS[@]}"; do
    display_step=$((step_index + 1))
    total_steps=${#STEP_LABELS[@]}
    echo "  ${display_step}/${total_steps} ${STEP_LABELS[$step_index]}"
  done
  if [[ -n "$METRICS_JSON_PATH" ]]; then
    STEP_DURATIONS=()
    for ((i=0; i<${#STEP_LABELS[@]}; i++)); do
      STEP_DURATIONS+=(0)
    done
    write_metrics_json
  fi
  exit 0
fi

for step_index in "${!STEP_LABELS[@]}"; do
  run_step "$step_index" "${STEP_LABELS[$step_index]}" "${STEP_COMMANDS[$step_index]}"
done

echo "All steps completed successfully."

if [[ "$PRINT_METRICS" == "1" ]]; then
  printf "\nStep timing summary (ms):\n"
  for i in "${!STEP_LABELS[@]}"; do
    duration="${STEP_DURATIONS[$i]:-0}"
    printf "  %03d  %-42s %12s\n" \
      $((i + 1)) "${STEP_LABELS[$i]}" "$duration"
  done
  echo "Total: ${#STEP_LABELS[@]} steps, ${#STEP_DURATIONS[@]} durations."
fi

if [[ -n "$METRICS_JSON_PATH" ]]; then
  write_metrics_json
fi
