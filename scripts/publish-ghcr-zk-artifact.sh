#!/usr/bin/env bash
# This file is part of midnightntwrk/midnight-did.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

token="${GH_TOKEN:?GH_TOKEN is required}"
version="${VERSION:?VERSION is required}"
archive="${ARCHIVE:?ARCHIVE is required}"
archive_name="${ARCHIVE_NAME:?ARCHIVE_NAME is required}"
manifest="${MANIFEST:?MANIFEST is required}"
owner="$(printf '%s' "${GITHUB_REPOSITORY_OWNER:?GITHUB_REPOSITORY_OWNER is required}" | tr '[:upper:]' '[:lower:]')"
repository="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
actor="${GITHUB_ACTOR:?GITHUB_ACTOR is required}"
sha="${GITHUB_SHA:?GITHUB_SHA is required}"
oci_ref="ghcr.io/${owner}/midnight-did-zk-artifacts:${version}"
pull_dir="$(mktemp -d)"

cleanup() {
  rm -rf "${pull_dir}"
}
trap cleanup EXIT

printf '%s' "${token}" | oras login ghcr.io --username "${actor}" --password-stdin
oras push "${oci_ref}" \
  "${archive}:application/vnd.midnight.did.zk-artifacts.archive.v1+gzip" \
  "${manifest}:application/vnd.midnight.did.zk-artifacts.manifest.v1+json" \
  --annotation "org.opencontainers.image.source=https://github.com/${repository}" \
  --annotation "org.opencontainers.image.version=${version}" \
  --annotation "org.opencontainers.image.revision=${sha}"

oras pull "${oci_ref}" --output "${pull_dir}"
node scripts/check-zk-artifact-bundle.mjs "${pull_dir}/${archive_name}"
node scripts/smoke-published-artifacts.mjs --skip-npm --zk-archive "${pull_dir}/${archive_name}"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "oci_ref=${oci_ref}" >> "${GITHUB_OUTPUT}"
fi
