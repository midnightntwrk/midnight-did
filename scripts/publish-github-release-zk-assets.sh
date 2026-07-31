#!/usr/bin/env bash
# This file is part of midnightntwrk/midnight-did.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

release_tag="${RELEASE_TAG:?RELEASE_TAG is required}"
prerelease="${PRERELEASE:?PRERELEASE is required}"
draft_release="${DRAFT_RELEASE:-true}"
archive="${ARCHIVE:?ARCHIVE is required}"
archive_name="${ARCHIVE_NAME:?ARCHIVE_NAME is required}"
manifest="${MANIFEST:?MANIFEST is required}"
sha256_file="${SHA256:?SHA256 is required}"
npm_assets_dir="${NPM_ASSETS_DIR:-}"
signature_assets_dir="${SIGNATURE_ASSETS_DIR:-}"
download_dir="$(mktemp -d)"

cleanup() {
  rm -rf "${download_dir}"
}
trap cleanup EXIT

release_args=(--target "${GITHUB_SHA:?GITHUB_SHA is required}" --title "${release_tag}" --notes "Midnight DID ${release_tag} packages and ZK artifacts.")
if [[ "${prerelease}" == "true" ]]; then
  release_args+=(--prerelease)
fi
if [[ "${draft_release}" == "true" ]]; then
  release_args+=(--draft)
fi

release_assets=("${archive}" "${manifest}" "${sha256_file}")
if [[ -n "${npm_assets_dir}" ]]; then
  while IFS= read -r npm_asset; do
    release_assets+=("${npm_asset}")
  done < <(find "${npm_assets_dir}" -maxdepth 1 -type f -name '*.tgz' | sort)
fi
if [[ -n "${signature_assets_dir}" ]]; then
  while IFS= read -r signature_asset; do
    release_assets+=("${signature_asset}")
  done < <(find "${signature_assets_dir}" -maxdepth 1 -type f \( -name '*.sig' -o -name '*.pem' \) | sort)
fi

release_exists=false
if release_json="$(gh release view "${release_tag}" --json isDraft,isPrerelease,assets 2>/dev/null)"; then
  release_exists=true
  actual_draft="$(jq -r '.isDraft' <<<"${release_json}")"
  if [[ "${actual_draft}" == "true" && "${draft_release}" != "true" ]]; then
    echo "::error::GitHub Release ${release_tag} is a draft, but this publication does not expect a draft release." >&2
    exit 1
  fi
  if [[ "${actual_draft}" == "false" && "${draft_release}" == "true" ]]; then
    echo "[publish-github-release-zk-assets] Reusing already-published immutable release ${release_tag}"
  fi
  expected_prerelease="${prerelease}"
  actual_prerelease="$(jq -r '.isPrerelease' <<<"${release_json}")"
  if [[ "${actual_prerelease}" != "${expected_prerelease}" ]]; then
    echo "::error::GitHub Release ${release_tag} prerelease state is ${actual_prerelease}, expected ${expected_prerelease}." >&2
    exit 1
  fi
fi

if [[ "${release_exists}" == "false" ]]; then
  gh release create "${release_tag}" "${release_assets[@]}" "${release_args[@]}"
else
  existing_asset_names="$(jq -r '.assets[].name' <<<"${release_json}")"
  assets_to_upload=()
  for asset in "${release_assets[@]}"; do
    asset_name="$(basename "${asset}")"
    if grep -Fqx "${asset_name}" <<<"${existing_asset_names}"; then
      echo "[publish-github-release-zk-assets] Reusing immutable release asset ${asset_name}"
    else
      assets_to_upload+=("${asset}")
    fi
  done

  if (( ${#assets_to_upload[@]} > 0 )); then
    gh release upload "${release_tag}" "${assets_to_upload[@]}"
  fi
fi

rm -rf "${download_dir}"
mkdir -p "${download_dir}"
for asset in "${release_assets[@]}"; do
  asset_name="$(basename "${asset}")"
  gh release download "${release_tag}" --pattern "${asset_name}" --dir "${download_dir}" --clobber
  if [[ "${asset_name}" == *.sig || "${asset_name}" == *.pem ]]; then
    continue
  fi
  if [[ "${asset_name}" == "${archive_name}" || "${asset_name}" == "$(basename "${manifest}")" ]]; then
    continue
  fi
  if [[ "${asset_name}" == *.tgz ]]; then
    if ! cmp -s "${asset}" "${download_dir}/${asset_name}" && ! node scripts/verify-npm-package-identity.mjs \
      --expected "${asset}" \
      --actual "${download_dir}/${asset_name}"; then
      echo "::error::Existing GitHub Release package asset differs: ${asset_name}" >&2
      exit 1
    fi
  fi
done

remote_manifest="${download_dir}/$(basename "${manifest}")"
( cd "${download_dir}" && sha256sum -c "$(basename "${sha256_file}")" )
node scripts/check-zk-artifact-bundle.mjs "${download_dir}/${archive_name}"
node scripts/verify-zk-artifact-identity.mjs \
  --expected-archive "${archive}" \
  --actual-archive "${download_dir}/${archive_name}" \
  --expected-manifest "${manifest}" \
  --actual-manifest "${remote_manifest}"
node scripts/smoke-published-artifacts.mjs --skip-npm --zk-archive "${download_dir}/${archive_name}"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  release_state="$(gh release view "${release_tag}" --json isDraft,assets)"
  provenance_present="$(jq -r '[.assets[].name | select(test("\\.intoto\\.jsonl$"))] | length > 0' <<<"${release_state}")"
  release_is_draft="$(jq -r '.isDraft' <<<"${release_state}")"
  echo "provenance_present=${provenance_present}" >> "${GITHUB_OUTPUT}"
  echo "release_draft=${release_is_draft}" >> "${GITHUB_OUTPUT}"
fi
