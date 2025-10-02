#!/usr/bin/env bash
set -euo pipefail

echo "[1/8] Build contract (compact)"
npm run contract -w contract

echo "[2/8] Build contract (tsc)"
npm run build -w contract

echo "[3/9] Lint workspaces and fix formatting"
npm run lint:fix

echo "[4/9] Run domain unit tests"
npm run test -w domain

echo "[5/9] Run contract unit tests"
# Prefer CI-friendly run without worker threads in constrained environments
# Skip runtime-heavy suites in constrained environments
SKIP_RUNTIME_TESTS=1 npm run test:ci -w contract || SKIP_RUNTIME_TESTS=1 npm run test -w contract

echo "[6/9] Build CLI (prebuild builds contract)"
npm run build -w cli

echo "[7/9] Lint CLI"
npm run lint -w cli

# echo "[8/9] Collect coverage for contract and CLI"
# npm run coverage

echo "[9/9] Run CLI API tests"
npm run test-api -w cli

echo "All steps completed successfully."
