#!/usr/bin/env bash
# This file is part of midnightntwrk/midnight-did.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

output_file="${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
signatures_dir="${SIGNATURE_ASSETS_DIR:-dist/release/signatures}"

asset_paths=()
if [[ -n "${NPM_ASSETS_DIR:-}" ]]; then
  while IFS= read -r npm_asset; do
    asset_paths+=("${npm_asset}")
  done < <(find "${NPM_ASSETS_DIR}" -maxdepth 1 -type f -name '*.tgz' | sort)
fi

for release_asset in "${ZK_ARCHIVE:-}" "${ZK_MANIFEST:-}" "${ZK_SHA256:-}"; do
  if [[ -n "${release_asset}" ]]; then
    asset_paths+=("${release_asset}")
  fi
done

if [[ "${#asset_paths[@]}" -eq 0 ]]; then
  echo "::error::No release assets were provided for signing."
  exit 1
fi

rm -rf "${signatures_dir}"
mkdir -p "${signatures_dir}"

for asset_path in "${asset_paths[@]}"; do
  if [[ ! -f "${asset_path}" ]]; then
    echo "::error::Release asset not found for signing: ${asset_path}"
    exit 1
  fi

  asset_name="$(basename "${asset_path}")"
  echo "[release-sign-assets] Signing ${asset_name}"
  cosign sign-blob \
    --yes \
    --output-certificate "${signatures_dir}/${asset_name}.pem" \
    --output-signature "${signatures_dir}/${asset_name}.sig" \
    "${asset_path}"
done

mapfile -t signature_assets < <(find "${signatures_dir}" -maxdepth 1 -type f \( -name '*.sig' -o -name '*.pem' \) | sort)
if [[ "${#signature_assets[@]}" -eq 0 ]]; then
  echo "::error::No signature assets were produced in ${signatures_dir}."
  exit 1
fi

echo "[release-sign-assets] Produced ${#signature_assets[@]} signature/certificate assets:"
printf '  %s\n' "${signature_assets[@]}"

{
  echo "signature_assets_dir=${signatures_dir}"
  echo "signature_assets<<EOF"
  printf '%s\n' "${signature_assets[@]}"
  echo "EOF"
} >> "${output_file}"
