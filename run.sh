#!/usr/bin/env bash
set -euo pipefail

STRICT_MODE=0
PRINT_METRICS=0
SKIP_COVERAGE=0

usage() {
  cat <<'EOF'
Usage: ./run.sh [--strict] [--metrics] [--skip-coverage] [-h|--help]

Runs the full local pipeline.

Options:
  --strict        Do not run lint:fix; fail if lint is not clean.
  --metrics       Print per-step wall-clock durations.
  --skip-coverage Skip all coverage steps (faster local runs).
  -h, --help      Show this help text.
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

node ./scripts/ensure-onchain-runtime-cjs.mjs

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
  add_step "Coverage contract" "npm run coverage -w contract || true"
fi

add_step "Build domain" "npm run build -w domain"
add_step "Test domain" "npm run test -w domain"

if [[ "$SKIP_COVERAGE" == "0" ]]; then
  add_step "Coverage domain" "npm run coverage -w domain || true"
fi

add_step "Build did" "npm run build -w did"
add_step "Test did" "npm run test -w did -- --pool=threads"

if [[ "$SKIP_COVERAGE" == "0" ]]; then
  add_step "Coverage did" "npm run coverage -w did || true"
fi

add_step "Build API and run tests" "npm run build -w api && npm run test -w api && npm run test-api -w api || true"
add_step "Build CLI" "npm run build -w cli"

add_step "Build and test DID resolver service" "npm run build -w did-resolver-service && npm run test -w did-resolver-service && npm run test:integration -w did-resolver-service"

if [[ "$SKIP_COVERAGE" == "0" ]]; then
  add_step "Coverage DID resolver service" "npm run coverage -w did-resolver-service || true"
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
