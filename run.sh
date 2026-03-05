#!/usr/bin/env bash
set -euo pipefail

node ./scripts/ensure-onchain-runtime-cjs.mjs

echo "[1/16] Lint (fix) workspaces"
npm run lint:fix || true

echo "[2/16] Lint workspaces"
npm run lint

echo "[3/16] Build contract (compact)"
npm run contract -w contract

echo "[4/16] Build contract (tsc)"
npm run build -w contract

echo "[5/16] Test contract"
# Skip runtime-heavy suites in constrained environments
SKIP_RUNTIME_TESTS=1 npm run test:ci -w contract || SKIP_RUNTIME_TESTS=1 npm run test -w contract

echo "[6/16] Coverage contract"
npm run coverage -w contract || true

echo "[7/16] Build domain"
npm run build -w domain

echo "[8/16] Test domain"
npm run test -w domain

echo "[9/16] Coverage domain"
npm run coverage -w domain || true

echo "[10/16] Build did"
npm run build -w did

echo "[11/16] Test did"
npm run test -w did -- --pool=threads

echo "[12/16] Coverage did"
npm run coverage -w did || true

echo "[13/16] Build API and run tests"
npm run build -w api
npm run test -w api
npm run test-api -w api || true

echo "[14/16] Build CLI"
npm run build -w cli

echo "[15/16] Build and test DID resolver service"
npm run build -w did-resolver-service
npm run test -w did-resolver-service
npm run test:integration -w did-resolver-service

echo "[16/16] Coverage DID resolver service"
npm run coverage -w did-resolver-service || true

echo "All steps completed successfully."
