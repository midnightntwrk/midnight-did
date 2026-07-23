#!/usr/bin/env bash
set -euo pipefail

node ./scripts/ensure-node-24.mjs

echo "[docs] Validate docs"
pnpm run docs:validate

echo "[docs] Build VitePress site"
pnpm run docs:build

echo "[docs] Check rendered docs layout"
pnpm run docs:visual

if [[ "${DOCS_PREVIEW:-0}" == "1" ]]; then
  echo "[docs] Preview built site"
  pnpm run docs:preview
else
  echo "[docs] Done"
  echo "[docs] Dev server: ./start-docs.sh"
  echo "[docs] Preview built site: DOCS_PREVIEW=1 ./run-docs.sh"
fi
