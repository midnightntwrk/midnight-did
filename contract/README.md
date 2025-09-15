@midnight-ntwrk/midnight-did-contract

Purpose
- Midnight DID contract package. Exposes the domain models, helpers, and bindings to the compiled Compact contract used by the CLI and other consumers.
- Package name: `@midnight-ntwrk/midnight-did-contract`.
- Public entrypoint: `dist/index.js` (types at `dist/index.d.ts`).

Prerequisites
- Node >= 20, npm >= 10.
- Compact compiler `compactc` available on PATH (v0.24+).

Useful scripts
- `npm run contract`: Compiles Compact circuits into `src/managed/did`.
- `npm run build`: Builds TypeScript to `dist/` and copies managed artifacts and `did.compact`.
- `npm run test`: Runs unit tests with Vitest.
- `npm run all`: `compact` + `build` + `test`.
- `npm run lint` / `npm run lint:fix` / `npm run typecheck`.

Common workflows
- Fresh build
  - From repo root: `npm install`.
  - From `contract/`: `npm run all`.
- Incremental build
  - `npm run build` (rebuilds `dist/` and copies artifacts).

Importing from other workspaces
- ESM: `import { DIDContract, DomainToLedger, LedgerToDomain } from '@midnight-ntwrk/midnight-did-contract';`

Artifacts
- Generated artifacts live under `src/managed/did` (source) and are copied to `dist/managed` during build.

