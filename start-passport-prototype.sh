#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-5174}"
HOST="${HOST:-127.0.0.1}"

source ./scripts/run-common.sh

run_common_ensure_node
run_common_ensure_runtime_helpers

echo "[start-passport-prototype] Generating prototype state"
npm run state:generate -w midnight-passport-prototype

echo "[start-passport-prototype] Serving http://${HOST}:${PORT}"
HOST="${HOST}" PORT="${PORT}" npm run app:serve -w midnight-passport-prototype
