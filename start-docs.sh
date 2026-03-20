#!/usr/bin/env bash
set -euo pipefail

node ./scripts/ensure-node-24.mjs

echo "[docs] Starting VitePress dev server"
npm run docs:dev
