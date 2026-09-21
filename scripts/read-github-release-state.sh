#!/usr/bin/env bash
# This file is part of midnightntwrk/midnight-did.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

state_file=""
github_output=""
while (($# > 0)); do
  case "$1" in
    --state-file)
      state_file="${2:?--state-file requires a value}"
      shift 2
      ;;
    --github-output)
      github_output="${2:?--github-output requires a value}"
      shift 2
      ;;
    *)
      echo "Usage: $0 --state-file FILE [--github-output FILE]" >&2
      exit 2
      ;;
  esac
done
if [[ -z "${state_file}" ]]; then
  echo "::error::--state-file is required." >&2
  exit 2
fi

release_tag="${RELEASE_TAG:?RELEASE_TAG is required}"
gh_repo="${GH_REPO:?GH_REPO is required}"
github_sha="${GITHUB_SHA:?GITHUB_SHA is required}"
gh_executable="$(command -v gh)"
node_executable="$(command -v node)"
read_timeout_ms="${GH_RELEASE_READ_TIMEOUT_MS:-30000}"
output_limit_bytes="${GH_RELEASE_OUTPUT_LIMIT_BYTES:-1048576}"
if [[ ! "${read_timeout_ms}" =~ ^[1-9][0-9]*$ ]] || ((read_timeout_ms > 30000)); then
  echo "::error::GH_RELEASE_READ_TIMEOUT_MS must be an integer from 1 through 30000." >&2
  exit 2
fi
if [[ ! "${output_limit_bytes}" =~ ^[1-9][0-9]*$ ]] || ((output_limit_bytes > 1048576)); then
  echo "::error::GH_RELEASE_OUTPUT_LIMIT_BYTES must be an integer from 1 through 1048576." >&2
  exit 2
fi
if [[ "${gh_repo}" != "midnightntwrk/midnight-did" ]] ||
  [[ ! "${github_sha}" =~ ^[0-9a-f]{40}$ ]] ||
  [[ ! "${release_tag}" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-rc[1-9][0-9]*)?$ ]]; then
  echo "::error::Release repository, source SHA, or tag is malformed." >&2
  exit 2
fi

gh_args=(
  release view "${release_tag}"
  --repo "${gh_repo}"
  --json isDraft,isPrerelease,assets,body
)
set +e
"${node_executable}" scripts/run-bounded-command.mjs \
  --timeout-ms "${read_timeout_ms}" \
  --output-limit "${output_limit_bytes}" \
  --output-file "${state_file}" \
  -- "${gh_executable}" "${gh_args[@]}"
view_status=$?
set -e

if ! classification="$("${node_executable}" scripts/classify-github-release-view.mjs \
  --status "${view_status}" \
  --output-file "${state_file}" 2>/dev/null)"; then
  echo "::error::Unable to confirm GitHub Release state; provider output suppressed." >&2
  exit 1
fi

case "${classification}" in
  absent)
    release_exists=false
    provenance_present=false
    ;;
  present)
    release_exists=true
    provenance_present=true
    tag_target_file="$(mktemp)"
    trap 'rm -f -- "${tag_target_file}"' EXIT
    set +e
    "${node_executable}" scripts/run-bounded-command.mjs \
      --timeout-ms "${read_timeout_ms}" \
      --output-limit "${output_limit_bytes}" \
      --output-file "${tag_target_file}" \
      -- "${gh_executable}" api "repos/${gh_repo}/commits/${release_tag}"
    tag_status=$?
    set -e
    if ((tag_status != 0)) ||
      ! "${node_executable}" scripts/verify-github-tag-target.mjs \
        --commit-json "${tag_target_file}" \
        --expected-sha "${github_sha}" 2>/dev/null; then
      echo "::error::Unable to bind the GitHub Release tag to the publication commit; provider output suppressed." >&2
      exit 1
    fi
    ;;
  *)
    echo "::error::Release-state classifier returned an invalid result; output suppressed." >&2
    exit 1
    ;;
esac

if [[ -n "${github_output}" ]]; then
  {
    echo "release_exists=${release_exists}"
    echo "provenance_present=${provenance_present}"
  } >> "${github_output}"
fi
printf '%s\n' "${classification}"
