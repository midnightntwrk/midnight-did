#!/usr/bin/env bash
# This file is part of midnightntwrk/midnight-did.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

version="${VERSION:?VERSION is required}"
npm_tag="${NPM_TAG:?NPM_TAG is required}"
registry="${NPM_REGISTRY:-https://npm.pkg.github.com}"

if [[ -z "${NODE_AUTH_TOKEN:-${NPM_TOKEN:-}}" ]]; then
  echo "::error::NODE_AUTH_TOKEN or NPM_TOKEN is required to publish packages."
  exit 1
fi

package_name_for_workspace() {
  node -e 'const fs = require("node:fs"); console.log(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).name);' "$1/package.json"
}

published_version_for_package() {
  local package_name="$1"
  local output
  local status

  output="$(npm view "${package_name}@${version}" version --registry "${registry}" 2>&1)" && status=0 || status=$?
  if [[ "${status}" -eq 0 ]]; then
    printf '%s\n' "${output}"
    return 0
  fi

  if grep -Eq "(E404|404 Not Found)" <<< "${output}"; then
    return 0
  fi

  echo "::error::npm view failed for ${package_name}@${version}: ${output}" >&2
  return "${status}"
}

while IFS= read -r workspace; do
  package_name="$(package_name_for_workspace "${workspace}")"
  published_version="$(published_version_for_package "${package_name}")"

  if [[ "${published_version}" == "${version}" ]]; then
    echo "[publish-npm-packages] ${package_name}@${version} already exists; skipping immutable npm publish."
    continue
  fi

  echo "[publish-npm-packages] Publishing ${package_name}@${version} with npm tag ${npm_tag}"
  pnpm --filter "./${workspace}" publish --no-git-checks --tag "${npm_tag}"
done < <(node scripts/did-workspace-catalog.mjs --publish-workspaces)
