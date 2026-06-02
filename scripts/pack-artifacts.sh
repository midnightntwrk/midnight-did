#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEST_DIR="${1:-$ROOT_DIR/artifacts/npm}"

source "$ROOT_DIR/scripts/artifact-workspaces.sh"

mkdir -p "$DEST_DIR"
rm -f "$DEST_DIR"/*.tgz

cd "$ROOT_DIR"
DID_PACKED_WORKSPACES=()
while IFS= read -r workspace; do
  DID_PACKED_WORKSPACES+=("$workspace")
done < <(did_artifact_workspaces)
if [[ "${#DID_PACKED_WORKSPACES[@]}" -eq 0 ]]; then
  echo "[pack-artifacts] DID artifact workspace catalog is empty or unavailable" >&2
  exit 1
fi

for workspace in "${DID_PACKED_WORKSPACES[@]}"; do
  echo "[pack-artifacts] Packing ${workspace} -> ${DEST_DIR}"
  pnpm --filter "./$workspace" pack --pack-destination "$DEST_DIR"
done
