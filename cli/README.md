@midnight-ntwrk/midnight-did-cli

Purpose
- Interactive CLI wrapper around the API for managing Midnight DIDs
- Provides scripts for local/testnet runs and Docker-compose helpers

Prerequisites
- Node 20 and npm >= 10

Build & Run
- `npm run build -w cli`
- Standalone network: `node --loader ts-node/esm src/standalone.ts`
- Testnet (remote): `node --loader ts-node/esm src/testnet-remote.ts`

Notes
- CLI uses the API package; tests for API live in `api`
