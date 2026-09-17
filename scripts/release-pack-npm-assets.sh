#!/usr/bin/env bash
# This file is part of midnightntwrk/midnight-did.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

version="${VERSION:?VERSION is required}"
output_file="${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
assets_dir="${NPM_ASSETS_DIR:-dist/release/npm}"

rm -rf "${assets_dir}"
mkdir -p "${assets_dir}"

while IFS= read -r workspace; do
  package_name="$(node -e 'const fs = require("node:fs"); console.log(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).name);' "${workspace}/package.json")"
  echo "[release-pack-npm-assets] Packing ${package_name}@${version} from ${workspace}"
  pnpm --filter "./${workspace}" pack --pack-destination "${assets_dir}" --json >/dev/null
done < <(node scripts/did-workspace-catalog.mjs --publish-workspaces)

mapfile -t package_assets < <(find "${assets_dir}" -maxdepth 1 -type f -name '*.tgz' | sort)
if [[ "${#package_assets[@]}" -ne 5 ]]; then
  echo "::error::Expected exactly five npm package tarballs in ${assets_dir}."
  exit 1
fi

node scripts/inspect-packed-npm-assets.mjs \
  --assets-dir "${assets_dir}" \
  --version "${version}" >/dev/null

echo "[release-pack-npm-assets] Packed and inventoried ${#package_assets[@]} npm package tarballs:"
printf '  %s\n' "${package_assets[@]}"

checksums_file="${assets_dir}/SHA256SUMS"
(
  cd "${assets_dir}"
  sha256sum ./*.tgz > "$(basename "${checksums_file}")"
)
checksums_sha256="$(sha256sum "${checksums_file}" | awk '{print $1}')"

{
  echo "npm_assets_dir=${assets_dir}"
  echo "npm_checksums_file=${checksums_file}"
  echo "npm_checksums_sha256=${checksums_sha256}"
} >> "${output_file}"
