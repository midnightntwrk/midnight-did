#!/usr/bin/env bash

# Shared artifact package catalog for pack-artifacts.sh and upgrade-libs.sh.
# Keep this list aligned with package manifests and docs through
# check:did-surface-discipline plus test:artifact-workspaces.
DID_ARTIFACT_WORKSPACES=(
  packages/api
  packages/domain
  packages/did
  packages/jubjub-schnorr
  packages/contract
)

did_artifact_workspaces() {
  printf '%s\n' "${DID_ARTIFACT_WORKSPACES[@]}"
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
