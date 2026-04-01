#!/usr/bin/env bash
set -euo pipefail

echo "[run-manager-preprod] Deprecated. Use ./start-manager.sh --preprod" >&2
exec ./start-manager.sh --preprod
