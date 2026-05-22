#!/usr/bin/env bash

# Shared artifact package catalog for pack-artifacts.sh and upgrade-libs.sh.
# The package order is owned by did-workspace-catalog.mjs so shell packaging,
# manifest checks, and Node tests all read the same package set.
DID_WORKSPACE_CATALOG_SCRIPT="${DID_WORKSPACE_CATALOG_SCRIPT:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/did-workspace-catalog.mjs}"

did_artifact_workspaces() {
  node "$DID_WORKSPACE_CATALOG_SCRIPT" --artifact-workspaces
}

did_artifact_resolve_destination() {
  local destination="$1"

  if [[ -d "$destination/libs" ]] || [[ -f "$destination/package.json" ]]; then
    printf '%s/libs/midnight-did\n' "$destination"
  elif [[ "$(basename "$destination")" == "libs" ]]; then
    printf '%s/midnight-did\n' "$destination"
  elif [[ "$(basename "$destination")" == "artifacts" ]]; then
    printf '%s/npm\n' "$destination"
  else
    printf '%s\n' "$destination"
  fi
}
