#!/usr/bin/env bash
set -euo pipefail

echo "[1/8] Build contract (compact)"
npm run contract -w contract

echo "[2/8] Build contract (tsc)"
npm run build -w contract

echo "[3/8] Lint workspaces and fix formatting"
npm run lint:fix

echo "[4/8] Run contract unit tests"
# Prefer CI-friendly run without worker threads in constrained environments
npm run test:ci -w contract || npm run test -w contract

echo "[5/8] Build CLI (prebuild builds contract)"
npm run build -w cli

echo "[6/8] Lint CLI"
npm run lint -w cli

echo "[7/8] Collect coverage for contract and CLI"
npm run coverage

echo "[8/8] Run CLI API tests"
npm run test-api -w cli

echo "All steps completed successfully."
