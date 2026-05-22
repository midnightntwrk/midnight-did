#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEST_DIR="${1:-$ROOT_DIR/artifacts/npm}"

source "$ROOT_DIR/scripts/artifact-workspaces.sh"

mkdir -p "$DEST_DIR"
rm -f "$DEST_DIR"/*.tgz

cd "$ROOT_DIR"
while IFS= read -r workspace; do
  echo "[pack-artifacts] Packing ${workspace} -> ${DEST_DIR}"
  npm pack --pack-destination "$DEST_DIR" -w "$workspace"
done < <(did_artifact_workspaces)
