#!/usr/bin/env bash
# This file is part of midnightntwrk/midnight-did.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

version="${VERSION:?VERSION is required}"
npm_tag="${NPM_TAG:?NPM_TAG is required}"
registry="${NPM_REGISTRY:-https://registry.npmjs.org/}"
publish_access="${NPM_ACCESS:-public}"
token="${NODE_AUTH_TOKEN:-${NPM_TOKEN:-}}"

if [[ -z "${token}" ]]; then
  echo "::error::NODE_AUTH_TOKEN or NPM_TOKEN is required to publish packages."
  exit 1
fi

registry_host="$(node -e 'console.log(new URL(process.argv[1]).host)' "${registry}")"
npmrc="$(mktemp)"
cleanup() {
  rm -f "${npmrc}"
}
trap cleanup EXIT

{
  echo "registry=${registry}"
  echo "//${registry_host}/:_authToken=${token}"
} > "${npmrc}"

export NPM_CONFIG_USERCONFIG="${npmrc}"

package_name_for_workspace() {
  node -e 'const fs = require("node:fs"); console.log(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).name);' "$1/package.json"
}

packed_tarball_for_package() {
  local package_name="$1"

  if [[ -z "${NPM_ASSETS_DIR:-}" ]]; then
    return 1
  fi

  local tarball_name
  tarball_name="$(node -e 'const name = process.argv[1]; const version = process.argv[2]; console.log(`${name.replace(/^@/, "").replace(/\//g, "-")}-${version}.tgz`);' "${package_name}" "${version}")"
  local tarball_path="${NPM_ASSETS_DIR}/${tarball_name}"

  if [[ ! -f "${tarball_path}" ]]; then
    echo "::error::Expected packed npm asset for ${package_name}@${version} was not found: ${tarball_path}" >&2
    exit 1
  fi

  printf '%s\n' "${tarball_path}"
}

published_version_for_package() {
  local package_name="$1"
  local output
  local status

  if output="$(npm view "${package_name}@${version}" version --loglevel=error --registry "${registry}" 2>&1)"; then
    printf '%s\n' "${output}"
    return 0
  fi

  status=$?
  if grep -Eq "(E404|404 Not Found)" <<< "${output}"; then
    return 0
  fi

  echo "::error::npm view failed for ${package_name}@${version}: ${output}" >&2
  return "${status}"
}

verify_published_package_integrity() {
  local package_name="$1"
  local tarball_path
  local local_integrity
  local remote_integrity

  if [[ -z "${NPM_ASSETS_DIR:-}" ]]; then
    return 0
  fi

  tarball_path="$(packed_tarball_for_package "${package_name}")"
  local_integrity="sha512-$(node -e 'const fs = require("node:fs"); const crypto = require("node:crypto"); console.log(crypto.createHash("sha512").update(fs.readFileSync(process.argv[1])).digest("base64"));' "${tarball_path}")"
  remote_integrity="$(npm view "${package_name}@${version}" dist.integrity --json --loglevel=error 2>/dev/null | node -e 'let value = ""; process.stdin.on("data", (chunk) => { value += chunk; }); process.stdin.on("end", () => { try { const parsed = JSON.parse(value); process.stdout.write(typeof parsed === "string" ? parsed : ""); } catch { process.stdout.write(""); } });')"

  if [[ -n "${remote_integrity}" && "${remote_integrity}" != "${local_integrity}" ]]; then
    echo "::error::Published ${package_name}@${version} integrity differs from the release tarball." >&2
    echo "::error::expected=${local_integrity} actual=${remote_integrity}" >&2
    exit 1
  fi
  if [[ -z "${remote_integrity}" ]]; then
    echo "::error::Published ${package_name}@${version} has no dist.integrity metadata to verify." >&2
    exit 1
  fi
}

ensure_public_access() {
  local package_name="$1"

  if [[ "${publish_access}" != "public" ]]; then
    return 0
  fi

  echo "[publish-npm-packages] Ensuring ${package_name} has public npm access"
  npm access set status=public "${package_name}" --registry "${registry}"
}

ensure_npm_dist_tag() {
  local package_name="$1"
  local latest_version

  echo "[publish-npm-packages] Ensuring ${package_name}@${version} has npm dist-tag ${npm_tag}"
  npm dist-tag add "${package_name}@${version}" "${npm_tag}" --registry "${registry}"

  if [[ "${npm_tag}" == "latest" ]]; then
    return 0
  fi

  latest_version="$(npm view "${package_name}" dist-tags.latest --registry "${registry}" 2>/dev/null || true)"
  if [[ "${latest_version}" == "${version}" ]]; then
    echo "[publish-npm-packages] Removing unintended latest tag from ${package_name}@${version}"
    npm dist-tag rm "${package_name}" latest --registry "${registry}"
  fi
}

while IFS= read -r workspace; do
  package_name="$(package_name_for_workspace "${workspace}")"
  published_version="$(published_version_for_package "${package_name}")"

  if [[ "${published_version}" == "${version}" ]]; then
    echo "[publish-npm-packages] ${package_name}@${version} already exists; skipping immutable npm publish."
    verify_published_package_integrity "${package_name}"
    ensure_public_access "${package_name}"
    ensure_npm_dist_tag "${package_name}"
    continue
  fi

  echo "[publish-npm-packages] Publishing ${package_name}@${version} with npm tag ${npm_tag} and Sigstore provenance"
  publish_args=(publish --provenance --no-git-checks --registry "${registry}" --tag "${npm_tag}")
  if [[ -n "${publish_access}" ]]; then
    publish_args+=(--access "${publish_access}")
  fi

  if [[ -n "${NPM_ASSETS_DIR:-}" ]]; then
    tarball_path="$(packed_tarball_for_package "${package_name}")"
    echo "[publish-npm-packages] Publishing pre-packed tarball ${tarball_path}"
    pnpm "${publish_args[@]}" "${tarball_path}"
  else
    echo "[publish-npm-packages] NPM_ASSETS_DIR is not set; publishing from workspace ${workspace}"
    pnpm --filter "./${workspace}" "${publish_args[@]}"
  fi

  ensure_public_access "${package_name}"
  ensure_npm_dist_tag "${package_name}"
done < <(node scripts/did-workspace-catalog.mjs --publish-workspaces)
