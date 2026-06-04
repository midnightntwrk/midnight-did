#!/usr/bin/env bash
# This file is part of midnightntwrk/midnight-did.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

args=(--channel "${CHANNEL:?CHANNEL is required}" --github-output "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}")

if [[ -n "${VERSION:-}" ]]; then
  args+=(--version "${VERSION}")
fi

if [[ -n "${RC_INDEX:-}" ]]; then
  args+=(--rc-index "${RC_INDEX}")
fi

node scripts/prepare-release-version.mjs "${args[@]}"
