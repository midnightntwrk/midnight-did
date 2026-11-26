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
trap 'rm -rf -- "${work}"' EXIT

npm_version="$(npm --version)"
if [[ "$(printf '%s\n' 11.5.1 "${npm_version}" | sort -V | head -n1)" != "11.5.1" ]]; then
  echo "::error::npm ${npm_version} predates Trusted Publishing support (needs >= 11.5.1)."
  exit 1
fi

view_stderr="${work}/npm-view-stderr"
view_or_missing() {
  if npm view "$1" "$2" --registry "${registry}" 2>"${view_stderr}"; then
    return 0
  fi
  if grep -Eq '(E404|404 Not Found)' "${view_stderr}"; then
    return 4
  fi
  echo "::error::npm view failed for $1; publication stopped." >&2
  cat "${view_stderr}" >&2
  return 1
}

shopt -s nullglob
tarballs=("${dir}"/*.tgz)
if [[ ${#tarballs[@]} -eq 0 ]]; then
  echo "::error::no tarballs found in ${dir}."
  exit 1
fi

missing=()
publish_stages=()
publish_names=()
publish_versions=()
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

  if view_or_missing "${new_name}@${version}" version >/dev/null; then
    echo "${new_name}@${version} is already published; skipping."
    continue
  else
    status=$?
    [[ "${status}" -eq 4 ]] || exit "${status}"
  fi
  if view_or_missing "${new_name}" name >/dev/null; then
    :
  else
    status=$?
    [[ "${status}" -eq 4 ]] || exit "${status}"
    missing+=("${new_name}")
    continue
  fi

  publish_stages+=("${stage}/package")
  publish_names+=("${new_name}")
  publish_versions+=("${version}")
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "::error::not on npmjs yet: ${missing[*]}. Bootstrap-publish each one once and add this workflow as its Trusted Publisher."
  exit 1
fi

for index in "${!publish_stages[@]}"; do
  (cd "${publish_stages[$index]}" && npm pkg set name="${publish_names[$index]}" &&
    npm publish --ignore-scripts --access public --provenance --tag "${tag}" --registry "${registry}")
  echo "Published ${publish_names[$index]}@${publish_versions[$index]} (dist-tag ${tag})."
done
