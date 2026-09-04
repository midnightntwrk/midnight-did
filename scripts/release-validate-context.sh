#!/usr/bin/env bash
# This file is part of midnightntwrk/midnight-did.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

release_context_error() {
  printf '::error::%s\n' "$1" >&2
  return 1
}

is_stable_semver() {
  [[ "$1" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]
}

validate_release_request() {
  local event_name="$1"
  local github_ref="$2"
  local github_ref_type="$3"
  local channel="$4"
  local base_version="$5"
  local rc_index="$6"

  if [[ "${github_ref_type}" != "branch" ]]; then
    release_context_error "Publication requires a branch ref."
    return 1
  fi

  case "${event_name}" in
    push)
      if [[ "${channel}" != "snapshot" || "${github_ref}" != "refs/heads/develop" ]]; then
        release_context_error "Push publication is only allowed for snapshots from refs/heads/develop."
        return 1
      fi
      if [[ -n "${base_version}" ]] && ! is_stable_semver "${base_version}"; then
        release_context_error "Resolved snapshot base version must be a stable SemVer."
        return 1
      fi
      if [[ -n "${rc_index}" ]]; then
        release_context_error "Snapshot publication does not accept an RC index."
        return 1
      fi
      ;;
    workflow_dispatch)
      if ! is_stable_semver "${base_version}"; then
        release_context_error "Manual version must be exactly one stable SemVer such as 0.6.0."
        return 1
      fi
      case "${channel}" in
        snapshot)
          if [[ "${github_ref}" != "refs/heads/develop" ]]; then
            release_context_error "Snapshot publication is only allowed from refs/heads/develop."
            return 1
          fi
          if [[ -n "${rc_index}" ]]; then
            release_context_error "Snapshot publication does not accept an RC index."
            return 1
          fi
          ;;
        rc)
          if [[ "${github_ref}" != "refs/heads/main" && "${github_ref}" != "refs/heads/develop" ]]; then
            release_context_error "RC publication is only allowed from refs/heads/main or refs/heads/develop."
            return 1
          fi
          if [[ ! "${rc_index}" =~ ^[1-9][0-9]*$ ]]; then
            release_context_error "RC index must be a positive integer for RC publication."
            return 1
          fi
          ;;
        release)
          if [[ "${github_ref}" != "refs/heads/main" ]]; then
            release_context_error "Final publication is only allowed from refs/heads/main."
            return 1
          fi
          if [[ -n "${rc_index}" ]]; then
            release_context_error "Final publication does not accept an RC index."
            return 1
          fi
          ;;
        *)
          release_context_error "Unsupported publication channel."
          return 1
          ;;
      esac
      ;;
    *)
      release_context_error "Unsupported publication event."
      return 1
      ;;
  esac
}

write_github_output_record() {
  local output_file="$1"
  local key="$2"
  local value="$3"

  if [[ ! "${key}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    release_context_error "Invalid GitHub output key."
    return 1
  fi
  if [[ ! "${value}" =~ ^[A-Za-z0-9._-]*$ ]]; then
    release_context_error "Refusing to write a non-scalar GitHub output value."
    return 1
  fi
  printf '%s=%s\n' "${key}" "${value}" >> "${output_file}"
}

validate_resolved_release_context() {
  local event_name="$1"
  local github_ref="$2"
  local github_ref_type="$3"
  local channel="$4"
  local base_version="$5"
  local release_version="$6"
  local rc_index="$7"
  local expected_version=""

  validate_release_request \
    "${event_name}" \
    "${github_ref}" \
    "${github_ref_type}" \
    "${channel}" \
    "${base_version}" \
    "${rc_index}"

  if ! is_stable_semver "${base_version}"; then
    release_context_error "Resolved base version must be a stable SemVer."
    return 1
  fi

  case "${channel}" in
    snapshot)
      local run_number="${GITHUB_RUN_NUMBER:-}"
      local github_sha="${GITHUB_SHA:-}"
      if [[ ! "${run_number}" =~ ^[1-9][0-9]*$ ]]; then
        release_context_error "Snapshot run number is invalid."
        return 1
      fi
      if [[ ! "${github_sha}" =~ ^[0-9A-Fa-f]{40}$ ]]; then
        release_context_error "Snapshot commit SHA is invalid."
        return 1
      fi
      expected_version="${base_version}-snapshot.${run_number}.${github_sha:0:12}"
      expected_version="$(printf '%s' "${expected_version}" | tr '[:upper:]' '[:lower:]')"
      ;;
    rc)
      expected_version="${base_version}-rc${rc_index}"
      ;;
    release)
      expected_version="${base_version}"
      ;;
  esac

  if [[ "${release_version}" != "${expected_version}" ]]; then
    release_context_error "Resolved release version does not match the current event, ref, and channel."
    return 1
  fi
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  validate_resolved_release_context \
    "${GITHUB_EVENT_NAME:?GITHUB_EVENT_NAME is required}" \
    "${GITHUB_REF:?GITHUB_REF is required}" \
    "${GITHUB_REF_TYPE:?GITHUB_REF_TYPE is required}" \
    "${CHANNEL:?CHANNEL is required}" \
    "${BASE_VERSION:?BASE_VERSION is required}" \
    "${RELEASE_VERSION:?RELEASE_VERSION is required}" \
    "${RC_INDEX:-}"
fi
