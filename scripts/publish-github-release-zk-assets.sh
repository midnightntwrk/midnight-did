#!/usr/bin/env bash
# This file is part of midnightntwrk/midnight-did.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

release_tag="${RELEASE_TAG:?RELEASE_TAG is required}"
prerelease="${PRERELEASE:?PRERELEASE is required}"
archive="${ARCHIVE:?ARCHIVE is required}"
archive_name="${ARCHIVE_NAME:?ARCHIVE_NAME is required}"
manifest="${MANIFEST:?MANIFEST is required}"
sha256_file="${SHA256:?SHA256 is required}"
npm_assets_dir="${NPM_ASSETS_DIR:-}"
download_dir="$(mktemp -d)"

cleanup() {
  rm -rf "${download_dir}"
}
trap cleanup EXIT

release_args=(--target "${GITHUB_SHA:?GITHUB_SHA is required}" --title "${release_tag}" --notes "Midnight DID ${release_tag} packages and ZK artifacts.")
if [[ "${prerelease}" == "true" ]]; then
  release_args+=(--prerelease)
fi

release_assets=("${archive}" "${manifest}" "${sha256_file}")
if [[ -n "${npm_assets_dir}" ]]; then
  while IFS= read -r npm_asset; do
    release_assets+=("${npm_asset}")
  done < <(find "${npm_assets_dir}" -maxdepth 1 -type f -name '*.tgz' | sort)
fi

if gh release view "${release_tag}" >/dev/null 2>&1; then
  gh release upload "${release_tag}" "${release_assets[@]}" --clobber
else
  gh release create "${release_tag}" "${release_assets[@]}" "${release_args[@]}"
fi

gh release download "${release_tag}" --pattern "${archive_name}" --dir "${download_dir}"
node scripts/check-zk-artifact-bundle.mjs "${download_dir}/${archive_name}"
node scripts/smoke-published-artifacts.mjs --skip-npm --zk-archive "${download_dir}/${archive_name}"
