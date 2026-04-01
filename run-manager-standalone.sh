#!/usr/bin/env bash
set -euo pipefail

echo "[run-manager-standalone] Deprecated. Use ./start-manager.sh --standalone" >&2
exec ./start-manager.sh --standalone
