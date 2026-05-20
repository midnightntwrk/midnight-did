#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEST_DIR="${1:-$ROOT_DIR/artifacts/npm}"

workspaces=(
  api
  domain
  did
  jubjub-schnorr
  contract
)

mkdir -p "$DEST_DIR"
rm -f "$DEST_DIR"/*.tgz

cd "$ROOT_DIR"
for workspace in "${workspaces[@]}"; do
  echo "[pack-artifacts] Packing ${workspace} -> ${DEST_DIR}"
  npm pack --pack-destination "$DEST_DIR" -w "$workspace"
done
