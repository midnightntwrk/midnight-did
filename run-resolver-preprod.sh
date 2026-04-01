#!/usr/bin/env bash
set -euo pipefail

echo "[run-resolver-preprod] Deprecated. Use ./start-resolver.sh --preprod" >&2
exec ./start-resolver.sh --preprod
