#!/usr/bin/env bash
# This file is part of midnightntwrk/midnight-did.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

token="${GH_TOKEN:?GH_TOKEN is required}"
version="${VERSION:?VERSION is required}"
archive="${ARCHIVE:?ARCHIVE is required}"
archive_name="${ARCHIVE_NAME:?ARCHIVE_NAME is required}"
manifest="${MANIFEST:?MANIFEST is required}"
manifest_name="$(basename "${manifest}")"
owner="$(printf '%s' "${GITHUB_REPOSITORY_OWNER:?GITHUB_REPOSITORY_OWNER is required}" | tr '[:upper:]' '[:lower:]')"
repository="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
actor="${GITHUB_ACTOR:?GITHUB_ACTOR is required}"
sha="${GITHUB_SHA:?GITHUB_SHA is required}"
oci_ref="ghcr.io/${owner}/midnight-did-zk-artifacts:${version}"
push_dir="$(mktemp -d)"
pull_dir="$(mktemp -d)"
remote_error="$(mktemp)"

cleanup() {
  rm -rf "${push_dir}" "${pull_dir}"
  rm -f "${remote_error}"
}
trap cleanup EXIT

cp "${archive}" "${push_dir}/${archive_name}"
cp "${manifest}" "${push_dir}/${manifest_name}"

printf '%s' "${token}" | oras login ghcr.io --username "${actor}" --password-stdin

if oras manifest fetch "${oci_ref}" >/dev/null 2>"${remote_error}"; then
  echo "[publish-ghcr-zk-artifact] ${oci_ref} already exists; preserving immutable release content."
elif grep -Eqi "MANIFEST_UNKNOWN|manifest unknown|not found|404" "${remote_error}"; then
  (
    cd "${push_dir}"
    oras push "${oci_ref}" \
      "${archive_name}:application/vnd.midnight.did.zk-artifacts.archive.v1+gzip" \
      "${manifest_name}:application/vnd.midnight.did.zk-artifacts.manifest.v1+json" \
      --annotation "org.opencontainers.image.source=https://github.com/${repository}" \
      --annotation "org.opencontainers.image.version=${version}" \
      --annotation "org.opencontainers.image.revision=${sha}"
  )
else
  cat "${remote_error}" >&2
  echo "::error::Unable to determine whether OCI artifact ${oci_ref} already exists." >&2
  exit 1
fi

oras pull "${oci_ref}" --output "${pull_dir}"
node scripts/check-zk-artifact-bundle.mjs "${pull_dir}/${archive_name}"
node scripts/verify-zk-artifact-identity.mjs \
  --expected-archive "${archive}" \
  --actual-archive "${pull_dir}/${archive_name}" \
  --expected-manifest "${manifest}" \
  --actual-manifest "${pull_dir}/${manifest_name}"
node scripts/smoke-published-artifacts.mjs --skip-npm --zk-archive "${pull_dir}/${archive_name}"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "oci_ref=${oci_ref}" >> "${GITHUB_OUTPUT}"
fi
