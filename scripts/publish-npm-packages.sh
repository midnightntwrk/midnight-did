#!/usr/bin/env bash
# This file is part of midnightntwrk/midnight-did.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

version="${VERSION:?VERSION is required}"
npm_tag="${NPM_TAG:?NPM_TAG is required}"
registry="${NPM_REGISTRY:-https://registry.npmjs.org/}"
publish_access="${NPM_ACCESS:-public}"
token="${NODE_AUTH_TOKEN:-${NPM_TOKEN:-}}"
assets_dir="${NPM_ASSETS_DIR:?NPM_ASSETS_DIR is required; publication only accepts pre-packed assets}"

if [[ -z "${token}" ]]; then
  echo "::error::NODE_AUTH_TOKEN or NPM_TOKEN is required to publish packages."
  exit 1
fi

inventory_file="$(mktemp)"
npmrc=""
temporary_files=("${inventory_file}")
cleanup() {
  if [[ "${#temporary_files[@]}" -gt 0 ]]; then
    rm -f -- "${temporary_files[@]}"
  fi
}
trap cleanup EXIT

if ! node scripts/inspect-packed-npm-assets.mjs \
  --assets-dir "${assets_dir}" \
  --version "${version}" > "${inventory_file}"; then
  echo "::error::Packed npm asset inventory failed before registry preflight." >&2
  exit 1
fi

mapfile -t inventory_rows < "${inventory_file}"
if [[ "${#inventory_rows[@]}" -ne 5 ]]; then
  echo "::error::Packed npm asset inventory must contain exactly five packages." >&2
  exit 1
fi

declare -a workspaces package_names tarballs local_integrities target_states access_states
for row in "${inventory_rows[@]}"; do
  IFS=$'\t' read -r workspace package_name packed_version tarball local_integrity <<< "${row}"
  if [[ -z "${workspace}" || -z "${package_name}" || "${packed_version}" != "${version}" || -z "${tarball}" || -z "${local_integrity}" ]]; then
    echo "::error::Malformed packed npm asset inventory row." >&2
    exit 1
  fi
  workspaces+=("${workspace}")
  package_names+=("${package_name}")
  tarballs+=("${tarball}")
  local_integrities+=("${local_integrity}")
done

echo "[publish-npm-packages] Inventoried all five local packed package identities before registry mutation."
for index in "${!package_names[@]}"; do
  echo "[publish-npm-packages] local ${package_names[index]}@${version} integrity=${local_integrities[index]}"
done

registry_host="$(node -e 'console.log(new URL(process.argv[1]).host)' "${registry}")"
npmrc="$(mktemp)"
temporary_files+=("${npmrc}")
{
  echo "registry=${registry}"
  echo "//${registry_host}/:_authToken=${token}"
} > "${npmrc}"
chmod 600 "${npmrc}"
export NPM_CONFIG_USERCONFIG="${npmrc}"

parse_json_string() {
  node -e 'let input=""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { try { const value=JSON.parse(input); if (typeof value !== "string") process.exit(1); process.stdout.write(value); } catch { process.exit(1); } });'
}

parse_remote_metadata() {
  node -e 'let input=""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { try { const value=JSON.parse(input); const version=value?.version; const integrity=value?.dist?.integrity; const tarball=value?.dist?.tarball; if (![version,integrity,tarball].every(item => typeof item === "string" && item.length > 0)) process.exit(1); process.stdout.write(`${version}\t${integrity}\t${tarball}`); } catch { process.exit(1); } });'
}

read_package_visibility() {
  local package_name="$1"
  local output
  if ! output="$(npm view "${package_name}" name --json --loglevel=error --registry "${registry}" 2>&1)"; then
    echo "::error::Unable to establish readable package metadata for ${package_name}; E404 may hide authorization and is ambiguous: ${output}" >&2
    return 1
  fi
  local visible_name
  if ! visible_name="$(parse_json_string <<< "${output}")" || [[ "${visible_name}" != "${package_name}" ]]; then
    echo "::error::Malformed package visibility evidence for ${package_name}." >&2
    return 1
  fi
}

read_access_status() {
  local package_name="$1"
  local output
  local status
  if ! output="$(npm access get status "${package_name}" --json --loglevel=error --registry "${registry}" 2>&1)"; then
    echo "::error::Unable to read npm access status for ${package_name}: ${output}" >&2
    return 1
  fi
  if ! status="$(parse_json_string <<< "${output}")"; then
    echo "::error::Malformed npm access status for ${package_name}." >&2
    return 1
  fi
  if [[ "${status}" != "public" && "${status}" != "restricted" ]]; then
    echo "::error::Unsupported npm access status for ${package_name}: ${status}" >&2
    return 1
  fi
  printf '%s\n' "${status}"
}

read_target_metadata() {
  local package_name="$1"
  local output
  if output="$(npm view "${package_name}@${version}" --json --loglevel=error --registry "${registry}" 2>&1)"; then
    if ! parse_remote_metadata <<< "${output}"; then
      echo "::error::Malformed exact-version metadata for ${package_name}@${version}." >&2
      return 1
    fi
    return 0
  fi
  if grep -Eq '(E404|404 Not Found)' <<< "${output}"; then
    return 2
  fi
  echo "::error::npm view failed for ${package_name}@${version}: ${output}" >&2
  return 1
}

verify_remote_payload() {
  local index="$1"
  local package_name="${package_names[index]}"
  local metadata
  local remote_version
  local remote_integrity
  local remote_url
  local metadata_status

  set +e
  metadata="$(read_target_metadata "${package_name}")"
  metadata_status=$?
  set -e
  if [[ "${metadata_status}" -ne 0 ]]; then
    if [[ "${metadata_status}" -eq 2 ]]; then
      echo "::error::Expected ${package_name}@${version} to exist during immutable payload verification." >&2
    fi
    return 1
  fi
  IFS=$'\t' read -r remote_version remote_integrity remote_url <<< "${metadata}"
  if [[ "${remote_version}" != "${version}" ]]; then
    echo "::error::Registry returned unexpected version for ${package_name}: ${remote_version}" >&2
    return 1
  fi
  if [[ "${remote_integrity}" == "${local_integrities[index]}" ]]; then
    return 0
  fi

  local remote_tarball
  remote_tarball="$(mktemp)"
  temporary_files+=("${remote_tarball}")
  if ! curl --fail --silent --show-error --location "${remote_url}" --output "${remote_tarball}"; then
    echo "::error::Unable to download ${package_name}@${version} for immutable identity verification." >&2
    return 1
  fi
  if ! node scripts/verify-npm-package-identity.mjs \
    --expected "${tarballs[index]}" \
    --actual "${remote_tarball}"; then
    echo "::error::Published ${package_name}@${version} payload differs from the expected packed identity." >&2
    return 1
  fi
  echo "[publish-npm-packages] ${package_name}@${version} matches package contents despite tarball metadata differences."
}

# Complete read-only package/access/exact-version inventory before any producer
# or metadata mutation. A visible package plus exact-version E404 is treated as
# absent; package-level E404 remains ambiguous and fails closed.
present_count=0
for index in "${!package_names[@]}"; do
  package_name="${package_names[index]}"
  read_package_visibility "${package_name}"
  access_states[index]="$(read_access_status "${package_name}")"

  set +e
  metadata="$(read_target_metadata "${package_name}")"
  metadata_status=$?
  set -e
  if [[ "${metadata_status}" -eq 2 ]]; then
    target_states[index]="absent"
    continue
  fi
  if [[ "${metadata_status}" -ne 0 ]]; then
    exit 1
  fi
  target_states[index]="present"
  present_count=$((present_count + 1))
  verify_remote_payload "${index}"
done

case "${present_count}" in
  0)
    echo "[publish-npm-packages] Remote preflight: none of the five target versions exists; eligible for fresh publication."
    ;;
  5)
    echo "[publish-npm-packages] Remote preflight: all five target versions exist and match; immutable rerun will publish none."
    ;;
  *)
    echo "[publish-npm-packages] Remote preflight: partial existing-version state (${present_count}/5); matching payloads permit recovery of missing packages only."
    ;;
esac
echo "[publish-npm-packages] Read-only preflight cannot prove a later package-version PUT or make five publishes transactional."

# Reconcile access only when read-only evidence explicitly reports restricted.
if [[ "${publish_access}" == "public" ]]; then
  for index in "${!package_names[@]}"; do
    if [[ "${access_states[index]}" != "restricted" ]]; then
      continue
    fi
    package_name="${package_names[index]}"
    echo "[publish-npm-packages] Reconciling explicit restricted access for ${package_name}."
    npm access set status=public "${package_name}" --registry "${registry}"
    reconciled_status="$(read_access_status "${package_name}")"
    if [[ "${reconciled_status}" != "public" ]]; then
      echo "::error::Access reconciliation read-back failed for ${package_name}: ${reconciled_status}" >&2
      exit 1
    fi
    access_states[index]="${reconciled_status}"
  done
fi

# pnpm remains the sole package producer. Publish only missing immutable versions
# and preserve catalog dependency order and Sigstore provenance.
for index in "${!package_names[@]}"; do
  if [[ "${target_states[index]}" == "present" ]]; then
    echo "[publish-npm-packages] ${package_names[index]}@${version} already exists; skipping immutable pnpm publish."
    continue
  fi
  echo "[publish-npm-packages] Publishing ${package_names[index]}@${version} from ${tarballs[index]} with npm tag ${npm_tag} and Sigstore provenance."
  publish_args=(publish --provenance --no-git-checks --registry "${registry}" --tag "${npm_tag}")
  if [[ -n "${publish_access}" ]]; then
    publish_args+=(--access "${publish_access}")
  fi
  pnpm "${publish_args[@]}" "${tarballs[index]}"
done

# No dist-tag mutation is allowed until every exact package payload has been
# re-read and verified after the producer phase.
for index in "${!package_names[@]}"; do
  verify_remote_payload "${index}"
done

echo "[publish-npm-packages] Verified all five exact immutable payloads; reconciling requested dist-tags."
read_dist_tags() {
  local package_name="$1"
  local output
  if ! output="$(npm view "${package_name}" dist-tags --json --loglevel=error --registry "${registry}" 2>&1)"; then
    echo "::error::Unable to read npm dist-tags for ${package_name}: ${output}" >&2
    return 1
  fi
  node -e 'let input=""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { try { const value=JSON.parse(input); const requested=value?.[process.argv[1]]; const latest=value?.latest; if (requested !== undefined && typeof requested !== "string") process.exit(1); if (latest !== undefined && typeof latest !== "string") process.exit(1); process.stdout.write(`${requested ?? ""}\t${latest ?? ""}`); } catch { process.exit(1); } });' "${npm_tag}" <<< "${output}"
}

for index in "${!package_names[@]}"; do
  package_name="${package_names[index]}"
  if ! tag_state="$(read_dist_tags "${package_name}")"; then
    exit 1
  fi
  IFS=$'\t' read -r requested_version latest_version <<< "${tag_state}"
  if [[ "${requested_version}" != "${version}" ]]; then
    echo "[publish-npm-packages] Setting ${package_name}@${version} dist-tag ${npm_tag}."
    npm dist-tag add "${package_name}@${version}" "${npm_tag}" --registry "${registry}"
  fi
  if [[ "${npm_tag}" != "latest" && "${latest_version}" == "${version}" ]]; then
    echo "[publish-npm-packages] Removing unintended latest tag from ${package_name}@${version}."
    npm dist-tag rm "${package_name}" latest --registry "${registry}"
  fi
done

# Final all-five read-back proves payload, public access, and requested tag state
# as observed after all mutations.
for index in "${!package_names[@]}"; do
  package_name="${package_names[index]}"
  verify_remote_payload "${index}"
  final_access="$(read_access_status "${package_name}")"
  if [[ "${publish_access}" == "public" && "${final_access}" != "public" ]]; then
    echo "::error::Final access read-back is not public for ${package_name}." >&2
    exit 1
  fi
  if ! tag_state="$(read_dist_tags "${package_name}")"; then
    exit 1
  fi
  IFS=$'\t' read -r requested_version latest_version <<< "${tag_state}"
  if [[ "${requested_version}" != "${version}" ]]; then
    echo "::error::Final dist-tag read-back failed for ${package_name}: ${npm_tag}=${requested_version}" >&2
    exit 1
  fi
  if [[ "${npm_tag}" != "latest" && "${latest_version}" == "${version}" ]]; then
    echo "::error::Final dist-tag read-back found unintended latest=${version} for ${package_name}." >&2
    exit 1
  fi
done

echo "[publish-npm-packages] Final all-five npm payload/access/dist-tag verification succeeded."
