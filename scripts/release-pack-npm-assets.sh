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
if [[ "${#package_assets[@]}" -eq 0 ]]; then
  echo "::error::No npm package tarballs were produced in ${assets_dir}."
  exit 1
fi

echo "[release-pack-npm-assets] Packed ${#package_assets[@]} npm package tarballs:"
printf '  %s\n' "${package_assets[@]}"

echo "npm_assets_dir=${assets_dir}" >> "${output_file}"
