@midnight-ntwrk/midnight-did-api

Purpose
- Programmatic API for interacting with the Midnight DID contract from Node.js
- Provides high-level functions (deploy, join, update, resolve) and test helpers
- Central place for runtime mapping (NetworkId <-> MidnightNetwork), config, and logging

Prerequisites
- Node 20 (see .nvmrc) and npm >= 10
- Docker (for integration tests using Testcontainers)

Install & Build
- `npm install`
- `npm run build -w api`

Run Tests
- Unit tests only: `npm run test -w api`
- Integration test (requires Docker): `npm run test-api -w api`

Notes
- Compose files live in this package root (standalone.yml/standalone-latest.yml)
- currentDir in `src/config.ts` resolves to the package root for both src and dist executions
