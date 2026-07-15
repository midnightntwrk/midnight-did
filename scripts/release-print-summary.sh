#!/usr/bin/env bash
# This file is part of midnightntwrk/midnight-did.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

cat <<SUMMARY
Published Midnight DID artifacts:
- npm tag: ${NPM_TAG:-}
- version: ${VERSION:-}
- GHCR: ${OCI_REF:-}
- release tag: ${RELEASE_TAG:-}
SUMMARY
