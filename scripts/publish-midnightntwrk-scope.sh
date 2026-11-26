#!/usr/bin/env bash
# Publishes each tested @midnight-ntwrk tarball again as @midnightntwrk/<name>
# while packages move to the @midnightntwrk npm scope. Uses npm Trusted
# Publishing (OIDC), so no npm token. Only the package name changes: the built
# code still imports sibling packages by their @midnight-ntwrk names, so
# dependencies are left as they are.
#   usage: publish-midnightntwrk-scope.sh <tarball-dir> <npm-tag>
# Delete this script, and the job that runs it, once @midnight-ntwrk is retired.
set -euo pipefail

dir="${1:?tarball directory required}"
tag="${2:?npm tag required}"
registry="https://registry.npmjs.org/"
work="$(mktemp -d)"

npm_version="$(npm --version)"
if [[ "$(printf '%s\n' 11.5.1 "${npm_version}" | sort -V | head -n1)" != "11.5.1" ]]; then
  echo "::error::npm ${npm_version} predates Trusted Publishing support (needs >= 11.5.1)."
  exit 1
fi
trap 'rm -rf -- "${work}"' EXIT

shopt -s nullglob
tarballs=("${dir}"/*.tgz)
if [[ ${#tarballs[@]} -eq 0 ]]; then
  echo "::error::no tarballs found in ${dir}."
  exit 1
fi

missing=()
for index in "${!tarballs[@]}"; do
  stage="${work}/${index}"
  mkdir -p "${stage}"
  tar -xzf "${tarballs[$index]}" -C "${stage}"
  manifest="${stage}/package/package.json"
  old_name="$(node -p 'require(process.argv[1]).name' "${manifest}")"
  version="$(node -p 'require(process.argv[1]).version' "${manifest}")"
  if [[ "${old_name}" != @midnight-ntwrk/* ]]; then
    echo "::error::unexpected package name ${old_name}."
    exit 1
  fi
  new_name="@midnightntwrk/${old_name#@midnight-ntwrk/}"

  if npm view "${new_name}@${version}" version --registry "${registry}" >/dev/null 2>&1; then
    echo "${new_name}@${version} is already published; skipping."
    continue
  fi
  if ! npm view "${new_name}" name --registry "${registry}" >/dev/null 2>&1; then
    missing+=("${new_name}")
    continue
  fi

  (cd "${stage}/package" && npm pkg set name="${new_name}" &&
    npm publish --ignore-scripts --access public --provenance --tag "${tag}" --registry "${registry}")
  echo "Published ${new_name}@${version} (dist-tag ${tag})."
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "::error::not on npmjs yet: ${missing[*]}. Bootstrap-publish each one once and add this workflow as its Trusted Publisher."
  exit 1
fi
