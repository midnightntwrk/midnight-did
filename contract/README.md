@midnight-ntwrk/midnight-did-contract

Purpose
- Contract artifacts and TypeScript glue for the Midnight DID contract
- Contains compact source, managed runtime bindings, and helper utilities

Prerequisites
- Node 20 and npm >= 10
- `@midnight-ntwrk/compact` CLI (automatically invoked via workspace scripts; see [compact releases](https://github.com/midnightntwrk/compact/releases/tag/compact-v0.2.0))

Build & Test
- Build compact: `npm run contract -w contract` (runs `compact compile src/did.compact src/managed/did`)
- Build TS: `npm run build -w contract`
- Test (CI-friendly): `SKIP_RUNTIME_TESTS=1 npm run test:ci -w contract`
- Coverage: `npm run coverage -w contract`

Notes
- Runtime-heavy suites require a full runtime environment; skip with `SKIP_RUNTIME_TESTS=1`
- Breaking change in the current unreleased contract surface: the old batched
  `ledger-operation-builder` export has been removed in favor of generated
  Compact circuits, and `removeVerificationMethod` is now a two-phase removal.
  Direct contract callers must remove all relation references before removing
  the verification method. The API package helper performs those relation
  removals for higher-level callers.
