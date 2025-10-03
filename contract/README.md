@midnight-ntwrk/midnight-did-contract

Purpose
- Contract artifacts and TypeScript glue for the Midnight DID contract
- Contains compact source, managed runtime bindings, and helper utilities

Prerequisites
- Node 20 and npm >= 10

Build & Test
- Build compact: `npm run contract -w contract`
- Build TS: `npm run build -w contract`
- Test (CI-friendly): `SKIP_RUNTIME_TESTS=1 npm run test:ci -w contract`
- Coverage: `npm run coverage -w contract`

Notes
- Runtime-heavy suites require a full runtime environment; skip with `SKIP_RUNTIME_TESTS=1`
