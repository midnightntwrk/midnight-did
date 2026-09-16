#!/usr/bin/env bash
# This file is part of midnightntwrk/midnight-did.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

readonly canonical_registry="https://registry.npmjs.org/"
readonly npm_read_timeout_ms="30000"
readonly npm_publish_timeout_ms="300000"
readonly npm_output_limit_bytes="65536"
readonly trusted_publishing_minimum_npm_version="11.5.1"
# npmjs metadata may converge after a successful immutable publish. Bound each
# post-publish package gate to five minutes, polling every 30 seconds; never
# retry the publish mutation itself.
readonly registry_convergence_deadline_seconds="300"
readonly registry_convergence_poll_seconds="30"
readonly tarball_connect_timeout_seconds="10"
readonly tarball_timeout_seconds="120"
readonly tarball_size_limit_bytes="104857600"

version="${VERSION:?VERSION is required}"
npm_tag="${NPM_TAG:?NPM_TAG is required}"
registry="${NPM_REGISTRY:-${canonical_registry}}"
assets_dir="${NPM_ASSETS_DIR:?NPM_ASSETS_DIR is required; publication only accepts pre-packed assets}"

reject_ambient_inputs() {
  if [[ "${registry}" != "${canonical_registry}" ]]; then
    echo "::error::Trusted Publishing requires the exact npmjs registry." >&2
    return 1
  fi
  if [[ -v NPM_CONFIG_REGISTRY && "${NPM_CONFIG_REGISTRY}" != "${canonical_registry}" ]]; then
    echo "::error::Trusted Publishing requires the exact npmjs registry." >&2
    return 1
  fi
  for name in NODE_AUTH_TOKEN NPM_TOKEN NPM_ID_TOKEN NODE_OPTIONS; do
    if [[ -v "${name}" ]]; then
      echo "::error::Ambient npm credentials and Node.js runtime injection are forbidden for Trusted Publishing." >&2
      return 1
    fi
  done
  if ! node -e '
    const forbidden = Object.keys(process.env).some(
      (name) => /^npm_config_/iu.test(name) &&
        /(?:^|_)(?:auth|auth_token|authtoken|password|token|username|otp|cert|certfile|key|keyfile)(?:$|_)/iu.test(name),
    );
    process.exit(forbidden ? 1 : 0);
  '; then
    echo "::error::Ambient npm credential configuration is forbidden for Trusted Publishing." >&2
    return 1
  fi
}

reject_ambient_inputs

inventory_file="$(mktemp)"
npmrc="$(mktemp)"
global_npmrc="$(mktemp)"
isolated_home="$(mktemp -d)"
isolated_cache="${isolated_home}/npm-cache"
isolated_tmp="${isolated_home}/tmp"
temporary_files=("${inventory_file}" "${npmrc}" "${global_npmrc}")
cleanup() {
  rm -f -- "${temporary_files[@]}"
  rm -rf -- "${isolated_home}"
}
trap cleanup EXIT
mkdir -m 700 "${isolated_cache}" "${isolated_tmp}"

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

declare -a workspaces package_names tarballs local_integrities target_states
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

printf 'registry=%s\nignore-scripts=true\n' "${canonical_registry}" > "${npmrc}"
: > "${global_npmrc}"
chmod 600 "${npmrc}" "${global_npmrc}"

node_executable="$(command -v node)"
npm_executable="$(command -v npm)"
base_npm_environment=(
  "CI=true"
  "HOME=${isolated_home}"
  "NPM_CONFIG_CACHE=${isolated_cache}"
  "NPM_CONFIG_GLOBALCONFIG=${global_npmrc}"
  "NPM_CONFIG_REGISTRY=${canonical_registry}"
  "NPM_CONFIG_USERCONFIG=${npmrc}"
  "PATH=${PATH}"
  "TMPDIR=${isolated_tmp}"
)
readonly -a provenance_environment_names=(
  ACTIONS_ID_TOKEN_REQUEST_TOKEN
  ACTIONS_ID_TOKEN_REQUEST_URL
  GITHUB_ACTIONS
  GITHUB_EVENT_NAME
  GITHUB_REF
  GITHUB_REPOSITORY
  GITHUB_REPOSITORY_ID
  GITHUB_REPOSITORY_OWNER_ID
  GITHUB_RUN_ATTEMPT
  GITHUB_RUN_ID
  GITHUB_SERVER_URL
  GITHUB_SHA
  GITHUB_WORKFLOW_REF
  RUNNER_ENVIRONMENT
)

run_bounded_npm() {
  local mode="$1"
  local output_file="$2"
  shift 2
  local timeout_ms="${npm_read_timeout_ms}"
  local -a command_environment=("${base_npm_environment[@]}")
  if [[ "${mode}" == "publish" ]]; then
    timeout_ms="${npm_publish_timeout_ms}"
    reject_ambient_inputs
    for name in "${provenance_environment_names[@]}"; do
      if [[ ! -v "${name}" || -z "${!name}" ]]; then
        echo "::error::Required GitHub OIDC/provenance context is unavailable." >&2
        return 1
      fi
      command_environment+=("${name}=${!name}")
    done
  fi
  env -i "${command_environment[@]}" \
    "${node_executable}" scripts/run-bounded-command.mjs \
    --timeout-ms "${timeout_ms}" \
    --output-limit "${npm_output_limit_bytes}" \
    --output-file "${output_file}" \
    -- "${npm_executable}" "$@"
}

verify_npm_version_at_publication_boundary() {
  local output_file
  output_file="$(mktemp)"
  temporary_files+=("${output_file}")
  if ! run_bounded_npm read "${output_file}" --version; then
    echo "::error::Unable to verify npm CLI at the publication boundary; provider output suppressed." >&2
    return 1
  fi
  if ! node -e '
    const fs = require("node:fs");
    const value = fs.readFileSync(process.argv[1], "utf8").trim();
    const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.exec(value);
    if (match == null) process.exit(1);
    const actual = match.slice(1).map(Number);
    const minimum = process.argv[2].split(".").map(Number);
    if (actual.some((part) => !Number.isSafeInteger(part))) process.exit(1);
    for (let index = 0; index < 3; index += 1) {
      if (actual[index] === minimum[index]) continue;
      process.exit(actual[index] > minimum[index] ? 0 : 1);
    }
  ' "${output_file}" "${trusted_publishing_minimum_npm_version}"; then
    echo "::error::npm ${trusted_publishing_minimum_npm_version} or newer is required at the publication boundary." >&2
    return 1
  fi
}

parse_json_string() {
  node -e 'let input=""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { try { const value=JSON.parse(input); if (typeof value !== "string") process.exit(1); process.stdout.write(value); } catch { process.exit(1); } });'
}

parse_remote_metadata() {
  node -e 'let input=""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { try { const value=JSON.parse(input); const version=value?.version; const integrity=value?.dist?.integrity; const tarball=value?.dist?.tarball; if (![version,integrity,tarball].every(item => typeof item === "string" && item.length > 0)) process.exit(1); process.stdout.write(`${version}\t${integrity}\t${tarball}`); } catch { process.exit(1); } });'
}

parse_dist_tags() {
  node -e 'let input=""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { try { const value=JSON.parse(input); if (value === null || typeof value !== "object" || Array.isArray(value)) process.exit(1); const requested=value[process.argv[1]]; const latest=value.latest; if (requested !== undefined && typeof requested !== "string") process.exit(1); if (latest !== undefined && typeof latest !== "string") process.exit(1); process.stdout.write(`${requested ?? ""}|${latest ?? ""}`); } catch { process.exit(1); } });' "${npm_tag}"
}

read_package_visibility() {
  local package_name="$1"
  local output_file output visible_name
  output_file="$(mktemp)"
  temporary_files+=("${output_file}")
  if ! run_bounded_npm read "${output_file}" view "${package_name}" name --json --loglevel=error --registry "${canonical_registry}"; then
    echo "::error::Unable to establish public package readability for ${package_name}; provider output suppressed." >&2
    return 1
  fi
  output="$(<"${output_file}")"
  if ! visible_name="$(parse_json_string <<< "${output}")" || [[ "${visible_name}" != "${package_name}" ]]; then
    echo "::error::Malformed public package metadata for ${package_name}; provider output suppressed." >&2
    return 1
  fi
}

read_target_metadata() {
  local package_name="$1"
  local output_file output status
  output_file="$(mktemp)"
  temporary_files+=("${output_file}")
  set +e
  run_bounded_npm read "${output_file}" view "${package_name}@${version}" --json --loglevel=error --registry "${canonical_registry}"
  status=$?
  set -e
  output="$(<"${output_file}")"
  if [[ "${status}" -eq 0 ]]; then
    if ! parse_remote_metadata <<< "${output}"; then
      echo "::error::Malformed exact-version metadata for ${package_name}@${version}; provider output suppressed." >&2
      return 1
    fi
    return 0
  fi
  if [[ "${status}" -ne 124 && "${status}" -ne 74 ]] && grep -Eq '(E404|404 Not Found)' <<< "${output}"; then
    return 2
  fi
  echo "::error::Unable to read ${package_name}@${version}; provider output suppressed." >&2
  return 1
}

read_dist_tags() {
  local package_name="$1"
  local output_file output
  output_file="$(mktemp)"
  temporary_files+=("${output_file}")
  if ! run_bounded_npm read "${output_file}" view "${package_name}" dist-tags --json --loglevel=error --registry "${canonical_registry}"; then
    echo "::error::Unable to read npm dist-tags for ${package_name}; provider output suppressed." >&2
    return 1
  fi
  output="$(<"${output_file}")"
  if ! parse_dist_tags <<< "${output}"; then
    echo "::error::Malformed npm dist-tags for ${package_name}; provider output suppressed." >&2
    return 1
  fi
}

verify_remote_payload_metadata() {
  local index="$1"
  local metadata="$2"
  local package_name="${package_names[index]}"
  local remote_version remote_integrity remote_url
  IFS=$'\t' read -r remote_version remote_integrity remote_url <<< "${metadata}"
  if [[ "${remote_version}" != "${version}" ]]; then
    echo "::error::Registry returned an unexpected version for ${package_name}." >&2
    return 1
  fi
  if [[ "${remote_integrity}" == "${local_integrities[index]}" ]]; then
    return 0
  fi

  local remote_tarball
  remote_tarball="$(mktemp)"
  temporary_files+=("${remote_tarball}")
  if ! curl --fail --silent --show-error --location \
    --connect-timeout "${tarball_connect_timeout_seconds}" \
    --max-time "${tarball_timeout_seconds}" \
    --max-filesize "${tarball_size_limit_bytes}" \
    "${remote_url}" --output "${remote_tarball}" >/dev/null 2>&1; then
    echo "::error::Unable to download ${package_name}@${version} for immutable identity verification; provider output suppressed." >&2
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

verify_remote_payload() {
  local index="$1"
  local package_name="${package_names[index]}"
  local metadata metadata_status

  set +e
  metadata="$(read_target_metadata "${package_name}")"
  metadata_status=$?
  set -e
  if [[ "${metadata_status}" -ne 0 ]]; then
    if [[ "${metadata_status}" -eq 2 ]]; then
      echo "::error::Expected ${package_name}@${version} during immutable payload verification." >&2
    fi
    return 1
  fi
  verify_remote_payload_metadata "${index}" "${metadata}"
}

verify_requested_tags() {
  local package_name="$1"
  local required_existing="$2"
  local tag_state requested_version latest_version
  if ! tag_state="$(read_dist_tags "${package_name}")"; then
    return 1
  fi
  IFS='|' read -r requested_version latest_version <<< "${tag_state}"
  if [[ "${required_existing}" == "true" && "${requested_version}" != "${version}" ]]; then
    echo "::error::Existing ${package_name}@${version} does not already own required dist-tag ${npm_tag}; repair is forbidden in the normal Trusted Publishing workflow." >&2
    return 1
  fi
  if [[ "${required_existing}" != "true" && "${requested_version}" == "${version}" ]]; then
    echo "::error::Dist-tag ${npm_tag} points to absent ${package_name}@${version}; registry evidence is inconsistent." >&2
    return 1
  fi
  if [[ "${npm_tag}" != "latest" && "${latest_version}" == "${version}" ]]; then
    echo "::error::Non-latest ${package_name}@${version} unexpectedly owns the latest dist-tag; repair is forbidden in the normal Trusted Publishing workflow." >&2
    return 1
  fi
}

registry_now_seconds() {
  local now
  if ! now="$(date +%s)" || [[ ! "${now}" =~ ^[0-9]+$ ]]; then
    echo "::error::Unable to measure the bounded npm registry convergence deadline." >&2
    return 1
  fi
  printf '%s' "${now}"
}

wait_for_published_registry_convergence() {
  local index="$1"
  local package_name="${package_names[index]}"
  local started_at deadline now remaining sleep_seconds
  local metadata metadata_status tag_state requested_version latest_version pending_reason

  started_at="$(registry_now_seconds)" || return 1
  deadline=$((started_at + registry_convergence_deadline_seconds))
  while true; do
    pending_reason=""
    set +e
    metadata="$(read_target_metadata "${package_name}")"
    metadata_status=$?
    set -e
    if [[ "${metadata_status}" -eq 0 ]]; then
      # Malformed metadata and confirmed immutable payload mismatches are fatal;
      # only propagation of valid exact-version/tag evidence is retried.
      verify_remote_payload_metadata "${index}" "${metadata}" || return 1
      tag_state="$(read_dist_tags "${package_name}")" || return 1
      IFS='|' read -r requested_version latest_version <<< "${tag_state}"
      if [[ "${npm_tag}" != "latest" && "${latest_version}" == "${version}" ]]; then
        echo "::error::Non-latest ${package_name}@${version} unexpectedly owns the latest dist-tag; repair is forbidden in the normal Trusted Publishing workflow." >&2
        return 1
      fi
      if [[ "${requested_version}" == "${version}" ]]; then
        now="$(registry_now_seconds)" || return 1
        if (( now < started_at )); then
          echo "::error::System clock moved backwards during bounded npm registry convergence." >&2
          return 1
        fi
        if (( now > deadline )); then
          echo "::error::npm registry evidence arrived after the ${registry_convergence_deadline_seconds}-second convergence deadline; provider output suppressed." >&2
          return 1
        fi
        echo "[publish-npm-packages] ${package_name}@${version} immutable payload and ${npm_tag} tag converged after $((now - started_at)) seconds."
        return 0
      fi
      pending_reason="requested dist-tag ${npm_tag}"
    elif [[ "${metadata_status}" -eq 2 ]]; then
      pending_reason="exact version metadata"
    else
      return 1
    fi

    now="$(registry_now_seconds)" || return 1
    if (( now < started_at )); then
      echo "::error::System clock moved backwards during bounded npm registry convergence." >&2
      return 1
    fi
    if (( now >= deadline )); then
      echo "::error::Timed out after ${registry_convergence_deadline_seconds} seconds waiting for ${package_name}@${version} ${pending_reason}; provider output suppressed." >&2
      return 1
    fi
    remaining=$((deadline - now))
    sleep_seconds="${registry_convergence_poll_seconds}"
    if (( sleep_seconds > remaining )); then
      sleep_seconds="${remaining}"
    fi
    echo "[publish-npm-packages] Waiting ${sleep_seconds} seconds for ${package_name}@${version} ${pending_reason} to converge."
    if ! sleep "${sleep_seconds}"; then
      echo "::error::Unable to wait for npm registry convergence." >&2
      return 1
    fi
  done
}

echo "[publish-npm-packages] Inventoried all five local packed package identities before registry reads."
for index in "${!package_names[@]}"; do
  echo "[publish-npm-packages] local ${package_names[index]}@${version} integrity=${local_integrities[index]}"
done

# Complete all-five visibility, exact-version, payload, and tag reads before the
# first publish. Existing packages must already be fully correct because this
# workflow has no npm administration authority.
present_count=0
for index in "${!package_names[@]}"; do
  package_name="${package_names[index]}"
  read_package_visibility "${package_name}"
  set +e
  metadata="$(read_target_metadata "${package_name}")"
  metadata_status=$?
  set -e
  if [[ "${metadata_status}" -eq 2 ]]; then
    target_states[index]="absent"
    verify_requested_tags "${package_name}" false
    continue
  fi
  if [[ "${metadata_status}" -ne 0 ]]; then
    exit 1
  fi
  target_states[index]="present"
  present_count=$((present_count + 1))
  verify_remote_payload "${index}"
  verify_requested_tags "${package_name}" true
done

case "${present_count}" in
  0) echo "[publish-npm-packages] Remote preflight: all five target versions are absent." ;;
  5) echo "[publish-npm-packages] Remote preflight: all five target versions and requested tags match; publishing none." ;;
  *) echo "[publish-npm-packages] Remote preflight: correct partial state (${present_count}/5); publishing missing packages only." ;;
esac
echo "[publish-npm-packages] Read-only preflight cannot prove a later publish or make five publishes transactional."

if [[ "${present_count}" -lt 5 ]]; then
  verify_npm_version_at_publication_boundary
  echo "[publish-npm-packages] Rechecked npm >=${trusted_publishing_minimum_npm_version} immediately before the publication boundary."
fi

for index in "${!package_names[@]}"; do
  if [[ "${target_states[index]}" == "present" ]]; then
    echo "[publish-npm-packages] ${package_names[index]}@${version} already matches payload and tag; skipping publish."
    continue
  fi
  echo "[publish-npm-packages] Publishing ${package_names[index]}@${version} with npm Trusted Publishing, tag ${npm_tag}, public access, and provenance."
  publish_output="$(mktemp)"
  temporary_files+=("${publish_output}")
  if ! run_bounded_npm publish "${publish_output}" publish --provenance --ignore-scripts --tag "${npm_tag}" --access public \
    --registry "${canonical_registry}" "${tarballs[index]}"; then
    echo "::error::npm publish failed for ${package_names[index]}@${version}; provider output suppressed." >&2
    exit 1
  fi

  # A successful provider exit is not sufficient evidence. npmjs can require
  # minutes to expose an immutable write, so retry only read-back evidence—not
  # publish—before granting the next dependent package a chance to publish.
  wait_for_published_registry_convergence "${index}"
done

# Retain an all-five final read-back so later registry inconsistency is caught.
for index in "${!package_names[@]}"; do
  package_name="${package_names[index]}"
  read_package_visibility "${package_name}"
  verify_remote_payload "${index}"
  verify_requested_tags "${package_name}" true
done

echo "[publish-npm-packages] Final all-five public metadata, payload, and dist-tag verification succeeded."
