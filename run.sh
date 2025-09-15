#!/usr/bin/env bash
set -euo pipefail

echo "[1/7] Build contract (compact)"
npm run contract -w contract

echo "[2/7] Build contract (tsc)"
npm run build -w contract

echo "[3/7] Lint workspaces"
npm run lint

echo "[4/7] Run contract unit tests"
npm run test -w contract

echo "[5/7] Build CLI (prebuild builds contract)"
npm run build -w cli

echo "[6/7] Lint CLI"
npm run lint -w cli

echo "[7/7] Run CLI API tests"
npm run test-api -w cli

echo "All steps completed successfully."

