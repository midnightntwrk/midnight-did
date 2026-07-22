#!/usr/bin/env bash
# This file is part of midnightntwrk/midnight-did.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

node scripts/smoke-published-artifacts.mjs \
  --version "${VERSION:?VERSION is required}" \
  --registry "${NPM_REGISTRY:-https://registry.npmjs.org/}" \
  --skip-zk
