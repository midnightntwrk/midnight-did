@midnight-ntwrk/midnight-did-cli

Purpose
- Command-line tooling to create, resolve, and update Midnight DIDs backed by the `@midnight-ntwrk/midnight-did-contract` smart contract.

Prerequisites
- Node >= 20, npm >= 10.
- The contract workspace builds first (the CLI prebuild hooks will do this for you).

Install
- From repo root: `npm install`.

Build
- `npm run build` (runs the contract build first via `prebuild`).

Tests
- `npm run test-api` (builds the contract first via `pretest-api` and runs Vitest integration tests).
- Optional: `npm run test-against-testnet` to target the public testnet (requires appropriate environment and connectivity).

Other scripts
- `npm run standalone`: Runs a local standalone environment script.
- `npm run testnet-local`: Runs against a local network.
- `npm run testnet-remote`: Runs against a remote testnet endpoint.
- `npm run testnet-remote-ps`: Starts a remote proof-server and runs.
- `npm run start-testnet-remote` / `npm run start-testnet-remote-ps`: Build then run the respective scripts.

Notes
- CLI imports the contract package by name: `@midnight-ntwrk/midnight-did-contract`.
- The CLI relies on Midnight JS providers (wallet, proof, indexer). Ensure any required environment (e.g., Docker, network access) is available when running integration tests.

