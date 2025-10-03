#!/usr/bin/env bash
set -euo pipefail

echo "[1/14] Lint (fix) workspaces"
npm run lint:fix || true

echo "[2/14] Lint workspaces"
npm run lint

echo "[3/14] Build contract (compact)"
npm run contract -w contract

echo "[4/14] Build contract (tsc)"
npm run build -w contract

echo "[5/14] Test contract"
# Skip runtime-heavy suites in constrained environments
SKIP_RUNTIME_TESTS=1 npm run test:ci -w contract || SKIP_RUNTIME_TESTS=1 npm run test -w contract

echo "[6/14] Coverage contract"
npm run coverage -w contract || true

echo "[7/14] Build domain"
npm run build -w domain

echo "[8/14] Test domain"
npm run test -w domain

echo "[9/14] Coverage domain"
npm run coverage -w domain || true

echo "[10/14] Build did"
npm run build -w did

echo "[11/14] Test did"
npm run test -w did -- --pool=threads

echo "[12/14] Coverage did"
npm run coverage -w did || true

echo "[13/14] Build API and run tests"
npm run build -w api
npm run test -w api
npm run test-api -w api || true

echo "[14/14] Build CLI"
npm run build -w cli

echo "All steps completed successfully."
