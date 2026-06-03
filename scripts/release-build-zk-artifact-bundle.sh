#!/usr/bin/env bash
# This file is part of midnightntwrk/midnight-did.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

node scripts/build-zk-artifact-bundle.mjs \
  --version "${VERSION:?VERSION is required}" \
  --github-output "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
