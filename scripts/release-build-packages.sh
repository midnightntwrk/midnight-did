#!/usr/bin/env bash
# This file is part of midnightntwrk/midnight-did.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

pnpm run test:workspace-manifests
pnpm run check:workspace-manifests
pnpm run test:artifact-workspaces
pnpm run build:all
pnpm run check:managed-artifacts
