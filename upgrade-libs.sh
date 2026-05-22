#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DESTINATION=""
LIST_PACKAGES=0

source "$ROOT_DIR/scripts/artifact-workspaces.sh"

usage() {
  cat >&2 <<USAGE
Usage: $0 --destination <path>
       $0 --list-packages

Build packed midnight-did tarballs and copy them into a destination directory.
The destination may be:
  - a downstream repo root (writes to libs/midnight-did)
  - a libs/ root (writes to midnight-did/)
  - a concrete output dir

Options:
  --destination <path>  Destination repo or directory to refresh.
  --list-packages      Print the DID package workspaces packed by this script.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --destination)
      DESTINATION="${2:-}"
      shift
      ;;
    --list-packages)
      LIST_PACKAGES=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[upgrade-libs] Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

if [[ "$LIST_PACKAGES" -eq 1 ]]; then
  did_artifact_workspaces
  exit 0
fi

if [[ -z "$DESTINATION" ]]; then
  usage
  exit 1
fi

DID_DEST="$(did_artifact_resolve_destination "$DESTINATION")"
"$ROOT_DIR/scripts/pack-artifacts.sh" "$DID_DEST"
echo "[upgrade-libs] DID tarballs refreshed in $DID_DEST"
