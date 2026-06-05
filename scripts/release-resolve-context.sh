#!/usr/bin/env bash
# This file is part of midnightntwrk/midnight-did.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

output_file="${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
event_name="${GITHUB_EVENT_NAME:?GITHUB_EVENT_NAME is required}"
ref_name="${GITHUB_REF_NAME:?GITHUB_REF_NAME is required}"

if [[ "${event_name}" == "push" ]]; then
  channel="snapshot"
  version=""
  rc_index=""
else
  channel="${DISPATCH_CHANNEL:-}"
  version="${DISPATCH_VERSION:-}"
  rc_index="${DISPATCH_RC_INDEX:-}"
fi

case "${channel}" in
  snapshot)
    if [[ "${ref_name}" != "main" && "${ref_name}" != "develop" ]]; then
      echo "::error::snapshot publication is only allowed from main or develop."
      exit 1
    fi
    ;;
  rc)
    if [[ "${ref_name}" != "main" && "${ref_name}" != "develop" ]]; then
      echo "::error::rc publication is only allowed from main or develop."
      exit 1
    fi
    if [[ ! "${rc_index}" =~ ^[1-9][0-9]*$ ]]; then
      echo "::error::rc_index must be a positive integer for rc publication."
      exit 1
    fi
    ;;
  release)
    if [[ "${ref_name}" != "main" ]]; then
      echo "::error::release publication is only allowed from main."
      exit 1
    fi
    ;;
  *)
    echo "::error::Unsupported publication channel: ${channel}"
    exit 1
    ;;
esac

{
  echo "channel=${channel}"
  echo "version=${version}"
  echo "rc_index=${rc_index}"
} >> "${output_file}"
