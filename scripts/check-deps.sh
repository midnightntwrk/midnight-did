#!/usr/bin/env bash
set -euo pipefail

if rg -n "@midnight-ntwrk/midnight-did-domain" packages/contract/src >/dev/null 2>&1; then
  echo "contract must not depend on domain"
  rg -n "@midnight-ntwrk/midnight-did-domain" packages/contract/src || true
  exit 1
fi

if rg -n "@midnight-ntwrk/midnight-did-(contract|did)" packages/domain/src >/dev/null 2>&1; then
  echo "domain must not depend on contract/did"
  rg -n "@midnight-ntwrk/midnight-did-(contract|did)" packages/domain/src || true
  exit 1
fi

echo "Dependency boundaries OK"
