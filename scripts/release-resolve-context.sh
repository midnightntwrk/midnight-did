#!/usr/bin/env bash
# This file is part of midnightntwrk/midnight-did.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

output_file="${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
event_name="${GITHUB_EVENT_NAME:?GITHUB_EVENT_NAME is required}"
github_ref="${GITHUB_REF:?GITHUB_REF is required}"
github_ref_type="${GITHUB_REF_TYPE:?GITHUB_REF_TYPE is required}"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source-path=SCRIPTDIR
source "${script_dir}/release-validate-context.sh"

if [[ "${event_name}" == "push" ]]; then
  channel="snapshot"
  version=""
  rc_index=""
else
  channel="${DISPATCH_CHANNEL:-}"
  version="${DISPATCH_VERSION:-}"
  rc_index="${DISPATCH_RC_INDEX:-}"
fi

validate_release_request \
  "${event_name}" \
  "${github_ref}" \
  "${github_ref_type}" \
  "${channel}" \
  "${version}" \
  "${rc_index}"

write_github_output_record "${output_file}" channel "${channel}"
write_github_output_record "${output_file}" version "${version}"
write_github_output_record "${output_file}" rc_index "${rc_index}"
