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

release_assets=("${archive}" "${manifest}" "${sha256_file}")
if [[ -n "${npm_assets_dir}" ]]; then
  while IFS= read -r npm_asset; do
    release_assets+=("${npm_asset}")
  done < <(find "${npm_assets_dir}" -maxdepth 1 -type f -name '*.tgz' | sort)
fi
if [[ -n "${signature_assets_dir}" ]]; then
  while IFS= read -r signature_asset; do
    release_assets+=("${signature_asset}")
  done < <(find "${signature_assets_dir}" -maxdepth 1 -type f \( -name '*.sig' -o -name '*.pem' \) | sort)
fi
if [[ -n "${provenance_file}" ]]; then
  release_assets+=("${provenance_file}")
fi

for asset in "${release_assets[@]}"; do
  if [[ ! -f "${asset}" ]]; then
    echo "::error::Release asset not found: ${asset}" >&2
    exit 1
  fi
done

release_args=(
  --target "${GITHUB_SHA:?GITHUB_SHA is required}"
  --title "${release_tag}"
  --notes-file "${notes_file}"
)
if [[ "${prerelease}" == "true" ]]; then
  release_args+=(--prerelease)
elif [[ "${prerelease}" != "false" ]]; then
  echo "::error::PRERELEASE must be true or false." >&2
  exit 1
fi

release_exists=false
release_state_file="$(mktemp)"
temporary_files+=("${release_state_file}")
if run_bounded_gh read "${release_state_file}" release view "${release_tag}" \
  --repo "${GH_REPO:?GH_REPO is required}" \
  --json isDraft,isPrerelease,assets,body; then
  release_exists=true
  state_args=(
    --release-json "${release_state_file}"
    --notes-file "${notes_file}"
    --prerelease "${prerelease}"
  )
  for asset in "${release_assets[@]}"; do
    state_args+=(--asset "${asset}")
  done
  "${node_executable}" scripts/verify-github-release-state.mjs "${state_args[@]}"
fi

if [[ "${release_exists}" == "false" ]]; then
  create_output="$(mktemp)"
  temporary_files+=("${create_output}")
  if ! run_bounded_gh mutation "${create_output}" release create "${release_tag}" \
    "${release_assets[@]}" "${release_args[@]}" --repo "${GH_REPO}"; then
    echo "::error::Unable to create the immutable GitHub Release; provider output suppressed." >&2
    exit 1
  fi
else
  for asset in "${release_assets[@]}"; do
    echo "[publish-github-release-assets] Reusing immutable release asset $(basename "${asset}")"
  done
fi

mkdir -p "${download_dir}"
for asset in "${release_assets[@]}"; do
  asset_name="$(basename "${asset}")"
  download_output="$(mktemp)"
  temporary_files+=("${download_output}")
  if ! run_bounded_gh read "${download_output}" release download "${release_tag}" \
    --repo "${GH_REPO}" \
    --pattern "${asset_name}" \
    --dir "${download_dir}" \
    --clobber; then
    echo "::error::Unable to download GitHub Release asset ${asset_name}; provider output suppressed." >&2
    exit 1
  fi
  if [[ "${asset_name}" == *.sig || "${asset_name}" == *.pem || "${asset_name}" == *.intoto.jsonl ]]; then
    continue
  fi
  if [[ "${asset_name}" == "${archive_name}" || "${asset_name}" == "$(basename "${manifest}")" ]]; then
    continue
  fi
  if [[ "${asset_name}" == *.tgz ]]; then
    if ! cmp -s "${asset}" "${download_dir}/${asset_name}" && ! node scripts/verify-npm-package-identity.mjs \
      --expected "${asset}" \
      --actual "${download_dir}/${asset_name}"; then
      echo "::error::Existing GitHub Release package asset differs: ${asset_name}" >&2
      exit 1
    fi
  fi
done

COSIGN_CERTIFICATE_IDENTITY="${COSIGN_CERTIFICATE_IDENTITY:?COSIGN_CERTIFICATE_IDENTITY is required}" \
COSIGN_CERTIFICATE_OIDC_ISSUER="${COSIGN_CERTIFICATE_OIDC_ISSUER:-https://token.actions.githubusercontent.com}" \
./scripts/verify-release-signatures.sh --assets-dir "${download_dir}"

remote_manifest="${download_dir}/$(basename "${manifest}")"
( cd "${download_dir}" && sha256sum -c "$(basename "${sha256_file}")" )
node scripts/check-zk-artifact-bundle.mjs "${download_dir}/${archive_name}"
node scripts/verify-zk-artifact-identity.mjs \
  --expected-archive "${archive}" \
  --actual-archive "${download_dir}/${archive_name}" \
  --expected-manifest "${manifest}" \
  --actual-manifest "${remote_manifest}"
node scripts/smoke-published-artifacts.mjs --skip-npm --zk-archive "${download_dir}/${archive_name}"

if [[ -n "${provenance_file}" && "${release_exists}" == "false" ]]; then
  if ! cmp -s "${provenance_file}" "${download_dir}/$(basename "${provenance_file}")"; then
    echo "::error::Published provenance asset differs from the generated provenance." >&2
    exit 1
  fi
fi
