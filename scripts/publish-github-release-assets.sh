#!/usr/bin/env bash
# This file is part of midnightntwrk/midnight-did.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

notes_file=""
while (($# > 0)); do
  case "$1" in
    --notes-file)
      notes_file="${2:?--notes-file requires a value}"
      shift 2
      ;;
    *)
      echo "Usage: $0 --notes-file FILE" >&2
      exit 2
      ;;
  esac
done
if [[ -z "${notes_file}" || ! -f "${notes_file}" || -L "${notes_file}" || ! -s "${notes_file}" ]]; then
  echo "::error::--notes-file must name a non-empty regular file." >&2
  exit 1
fi

release_tag="${RELEASE_TAG:?RELEASE_TAG is required}"
prerelease="${PRERELEASE:?PRERELEASE is required}"
archive="${ARCHIVE:?ARCHIVE is required}"
archive_name="${ARCHIVE_NAME:?ARCHIVE_NAME is required}"
manifest="${MANIFEST:?MANIFEST is required}"
sha256_file="${SHA256:?SHA256 is required}"
npm_assets_dir="${NPM_ASSETS_DIR:-}"
signature_assets_dir="${SIGNATURE_ASSETS_DIR:-}"
provenance_file="${PROVENANCE_FILE:-}"
gh_repo="${GH_REPO:?GH_REPO is required}"
github_sha="${GITHUB_SHA:?GITHUB_SHA is required}"
github_ref="${GITHUB_REF:?GITHUB_REF is required}"
base_version="${BASE_VERSION:?BASE_VERSION is required}"
channel="${CHANNEL:?CHANNEL is required}"
rc_index="${RC_INDEX:-}"
readonly canonical_repo="midnightntwrk/midnight-did"
readonly canonical_provenance_name="multiple.intoto.jsonl"
readonly slsa_predicate_type="https://slsa.dev/provenance/v0.2"
readonly slsa_certificate_identity="https://github.com/slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@f7dd8c54c2067bafc12ca7a55595d5ee9b75204a"
readonly slsa_oidc_issuer="https://token.actions.githubusercontent.com"
readonly slsa_entry_point=".github/workflows/publish.yml"
if [[ "${gh_repo}" != "${canonical_repo}" ]]; then
  echo "::error::GH_REPO must be ${canonical_repo}." >&2
  exit 1
fi

download_dir="$(mktemp -d)"
gh_executable="$(command -v gh)"
node_executable="$(command -v node)"
readonly gh_read_timeout_ms="30000"
readonly gh_mutation_timeout_ms="300000"
readonly gh_output_limit_bytes="1048576"
temporary_files=()

cleanup() {
  rm -rf -- "${download_dir}"
  if ((${#temporary_files[@]} > 0)); then
    rm -f -- "${temporary_files[@]}"
  fi
}
trap cleanup EXIT

notes_verify_output="$(mktemp)"
temporary_files+=("${notes_verify_output}")
if ! "${node_executable}" scripts/validate-release-notes.mjs --notes-file "${notes_file}" \
  >"${notes_verify_output}" 2>&1; then
  echo "::error::Reviewed changelog notes are not canonical; verifier output suppressed." >&2
  exit 1
fi

run_bounded_gh() {
  local mode="$1"
  local output_file="$2"
  shift 2
  local timeout_ms="${gh_read_timeout_ms}"
  if [[ "${mode}" == "mutation" ]]; then
    timeout_ms="${gh_mutation_timeout_ms}"
  fi
  "${node_executable}" scripts/run-bounded-command.mjs \
    --timeout-ms "${timeout_ms}" \
    --output-limit "${gh_output_limit_bytes}" \
    --output-file "${output_file}" \
    -- "${gh_executable}" "$@"
}

non_provenance_assets=("${archive}" "${manifest}" "${sha256_file}")
if [[ -n "${npm_assets_dir}" ]]; then
  while IFS= read -r npm_asset; do
    non_provenance_assets+=("${npm_asset}")
  done < <(find "${npm_assets_dir}" -maxdepth 1 -type f -name '*.tgz' | sort)
fi
if [[ -n "${signature_assets_dir}" ]]; then
  while IFS= read -r signature_asset; do
    non_provenance_assets+=("${signature_asset}")
  done < <(find "${signature_assets_dir}" -maxdepth 1 -type f \( -name '*.sig' -o -name '*.pem' \) | sort)
fi

release_assets=()
expected_asset_names=()
local_asset_names=()
local_asset_paths=()
for asset in "${non_provenance_assets[@]}"; do
  if [[ ! -f "${asset}" ]]; then
    echo "::error::Release asset not found: ${asset}" >&2
    exit 1
  fi
  asset_name="$(basename "${asset}")"
  if ((${#local_asset_names[@]} > 0)); then
    for existing_name in "${local_asset_names[@]}"; do
      if [[ "${existing_name}" == "${asset_name}" ]]; then
        echo "::error::Canonical release asset names contain a duplicate." >&2
        exit 1
      fi
    done
  fi
  local_asset_names+=("${asset_name}")
  local_asset_paths+=("${asset}")
  release_assets+=("${asset}")
  expected_asset_names+=("${asset_name}")
done
expected_asset_names+=("${canonical_provenance_name}")

if [[ -n "${provenance_file}" ]]; then
  if [[ ! -f "${provenance_file}" || -L "${provenance_file}" || "$(basename "${provenance_file}")" != "${canonical_provenance_name}" ]]; then
    echo "::error::Generated provenance must be the regular file ${canonical_provenance_name}." >&2
    exit 1
  fi
  if ((${#local_asset_names[@]} > 0)); then
    for existing_name in "${local_asset_names[@]}"; do
      if [[ "${existing_name}" == "${canonical_provenance_name}" ]]; then
        echo "::error::Canonical release asset names contain a duplicate." >&2
        exit 1
      fi
    done
  fi
  local_asset_names+=("${canonical_provenance_name}")
  local_asset_paths+=("${provenance_file}")
  release_assets+=("${provenance_file}")
fi

verify_provenance() {
  local bundle_file="$1"
  local subject_archive="$2"
  shift 2
  local subject_assets=("$@")
  local attestation_output semantic_output
  attestation_output="$(mktemp)"
  semantic_output="$(mktemp)"
  temporary_files+=("${attestation_output}" "${semantic_output}")
  local attestation_args=(
    attestation verify "${subject_archive}"
    --bundle "${bundle_file}"
    --repo "${canonical_repo}"
    --cert-identity "${slsa_certificate_identity}"
    --cert-oidc-issuer "${slsa_oidc_issuer}"
    --predicate-type "${slsa_predicate_type}"
    --format json
  )
  if ! run_bounded_gh read "${attestation_output}" "${attestation_args[@]}"; then
    echo "::error::GitHub Release provenance signature or certificate policy verification failed; provider output suppressed." >&2
    return 1
  fi

  local semantic_args=(
    --verified-json "${attestation_output}"
    --github-sha "${github_sha}"
    --source-ref "${github_ref}"
    --source-repo "${canonical_repo}"
    --builder-id "${slsa_certificate_identity}"
    --entry-point "${slsa_entry_point}"
    --channel "${channel}"
    --version "${base_version}"
  )
  if [[ "${channel}" == "rc" ]]; then
    semantic_args+=(--rc-index "${rc_index}")
  fi
  for asset in "${subject_assets[@]}"; do
    semantic_args+=(--asset "${asset}")
  done
  if ! "${node_executable}" scripts/verify-slsa-provenance.mjs "${semantic_args[@]}" \
    >"${semantic_output}" 2>&1; then
    echo "::error::GitHub Release provenance semantics do not match the release; verifier output suppressed." >&2
    return 1
  fi
}

verify_release_state() {
  local state_file="$1"
  local state_args=(
    --release-json "${state_file}"
    --notes-file "${notes_file}"
    --prerelease "${prerelease}"
  )
  for asset_name in "${expected_asset_names[@]}"; do
    state_args+=(--asset-name "${asset_name}")
  done
  local state_verify_output
  state_verify_output="$(mktemp)"
  temporary_files+=("${state_verify_output}")
  if ! "${node_executable}" scripts/verify-github-release-state.mjs "${state_args[@]}" \
    >"${state_verify_output}" 2>&1; then
    echo "::error::Existing immutable GitHub Release body or asset multiset is not canonical; verifier output suppressed." >&2
    return 1
  fi
}

download_release_asset() {
  local asset_name="$1"
  local download_output
  download_output="$(mktemp)"
  temporary_files+=("${download_output}")
  if ! run_bounded_gh read "${download_output}" release download "${release_tag}" \
    --repo "${gh_repo}" \
    --pattern "${asset_name}" \
    --dir "${download_dir}" \
    --clobber; then
    echo "::error::Unable to download GitHub Release asset ${asset_name}; provider output suppressed." >&2
    return 1
  fi
}

release_args=(
  --target "${github_sha}"
  --title "${release_tag}"
  --notes-file "${notes_file}"
)
if [[ "${prerelease}" == "true" ]]; then
  release_args+=(--prerelease)
elif [[ "${prerelease}" != "false" ]]; then
  echo "::error::PRERELEASE must be true or false." >&2
  exit 1
fi

release_state_file="$(mktemp)"
temporary_files+=("${release_state_file}")
if ! release_classification="$(GH_RELEASE_READ_TIMEOUT_MS="${GH_RELEASE_READ_TIMEOUT_MS:-30000}" \
  GH_RELEASE_OUTPUT_LIMIT_BYTES="${GH_RELEASE_OUTPUT_LIMIT_BYTES:-1048576}" \
  ./scripts/read-github-release-state.sh --state-file "${release_state_file}")"; then
  echo "::error::Unable to read immutable GitHub Release state; provider output suppressed." >&2
  exit 1
fi

if [[ "${release_classification}" == "present" ]]; then
  verify_release_state "${release_state_file}"
  mkdir -p "${download_dir}"
  download_release_asset "${canonical_provenance_name}"
  verify_provenance \
    "${download_dir}/${canonical_provenance_name}" \
    "${archive}" \
    "${non_provenance_assets[@]}"
elif [[ "${release_classification}" == "absent" ]]; then
  if [[ -z "${provenance_file}" ]]; then
    echo "::error::A confirmed-absent GitHub Release requires ${canonical_provenance_name}." >&2
    exit 1
  fi
  verify_provenance \
    "${provenance_file}" \
    "${archive}" \
    "${non_provenance_assets[@]}"
  create_output="$(mktemp)"
  temporary_files+=("${create_output}")
  if ! run_bounded_gh mutation "${create_output}" release create "${release_tag}" \
    "${release_assets[@]}" "${release_args[@]}" --repo "${gh_repo}"; then
    echo "::error::Unable to create the immutable GitHub Release; provider output suppressed." >&2
    exit 1
  fi
  post_create_state_file="$(mktemp)"
  temporary_files+=("${post_create_state_file}")
  if ! post_create_classification="$(GH_RELEASE_READ_TIMEOUT_MS="${GH_RELEASE_READ_TIMEOUT_MS:-30000}" \
    GH_RELEASE_OUTPUT_LIMIT_BYTES="${GH_RELEASE_OUTPUT_LIMIT_BYTES:-1048576}" \
    ./scripts/read-github-release-state.sh --state-file "${post_create_state_file}")" ||
    [[ "${post_create_classification}" != "present" ]]; then
    echo "::error::Unable to bind the created GitHub Release to the publication commit; provider output suppressed." >&2
    exit 1
  fi
  verify_release_state "${post_create_state_file}"
else
  echo "::error::Release-state classification is invalid; output suppressed." >&2
  exit 1
fi

mkdir -p "${download_dir}"
remote_non_provenance_assets=()
for asset_name in "${expected_asset_names[@]}"; do
  if [[ "${asset_name}" != "${canonical_provenance_name}" || "${release_classification}" != "present" ]]; then
    download_release_asset "${asset_name}"
  fi
  if [[ "${asset_name}" != "${canonical_provenance_name}" ]]; then
    remote_non_provenance_assets+=("${download_dir}/${asset_name}")
  fi
  local_asset=""
  for ((asset_index = 0; asset_index < ${#local_asset_names[@]}; asset_index += 1)); do
    if [[ "${local_asset_names[${asset_index}]}" == "${asset_name}" ]]; then
      local_asset="${local_asset_paths[${asset_index}]}"
      break
    fi
  done
  if [[ -n "${local_asset}" ]]; then
    if [[ "${asset_name}" == *.tgz ]]; then
      if ! cmp -s "${local_asset}" "${download_dir}/${asset_name}" && ! "${node_executable}" scripts/verify-npm-package-identity.mjs \
        --expected "${local_asset}" \
        --actual "${download_dir}/${asset_name}"; then
        echo "::error::Existing GitHub Release package asset differs: ${asset_name}" >&2
        exit 1
      fi
    elif [[ "${asset_name}" == "${canonical_provenance_name}" ]] && ! cmp -s "${local_asset}" "${download_dir}/${asset_name}"; then
      echo "::error::Published provenance asset differs from the generated provenance." >&2
      exit 1
    fi
  fi
done

# Bind the exact downloaded byte set before signatures, checksums, archives, or
# packages from an existing release are parsed.
verify_provenance \
  "${download_dir}/${canonical_provenance_name}" \
  "${download_dir}/${archive_name}" \
  "${remote_non_provenance_assets[@]}"

COSIGN_CERTIFICATE_IDENTITY="${COSIGN_CERTIFICATE_IDENTITY:?COSIGN_CERTIFICATE_IDENTITY is required}" \
COSIGN_CERTIFICATE_OIDC_ISSUER="${COSIGN_CERTIFICATE_OIDC_ISSUER:-https://token.actions.githubusercontent.com}" \
./scripts/verify-release-signatures.sh --assets-dir "${download_dir}"

remote_manifest="${download_dir}/$(basename "${manifest}")"
( cd "${download_dir}" && sha256sum -c "$(basename "${sha256_file}")" )
"${node_executable}" scripts/check-zk-artifact-bundle.mjs "${download_dir}/${archive_name}"
"${node_executable}" scripts/verify-zk-artifact-identity.mjs \
  --expected-archive "${archive}" \
  --actual-archive "${download_dir}/${archive_name}" \
  --expected-manifest "${manifest}" \
  --actual-manifest "${remote_manifest}"
"${node_executable}" scripts/smoke-published-artifacts.mjs --skip-npm --zk-archive "${download_dir}/${archive_name}"

if [[ "${release_classification}" == "present" ]]; then
  for asset_name in "${expected_asset_names[@]}"; do
    echo "[publish-github-release-assets] Reusing immutable release asset ${asset_name}"
  done
fi
