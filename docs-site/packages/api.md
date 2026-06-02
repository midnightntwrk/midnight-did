# API Package

`@midnight-ntwrk/midnight-did-api` is the runtime orchestration package used by
tests and higher-level applications that need DID contract operations.

## Focus

- Midnight DID runtime orchestration
- wallet/provider setup
- DID contract lifecycle operations
- reusable programmatic interface for DID-aware applications

## Use it when

- you need to deploy or update Midnight DID contracts
- you need provider bootstrap for standalone, preprod, or mainnet flows
- you want the highest-level reusable programmatic API in this repository

## Main repository paths

- `packages/api/src/lib.ts`
- `packages/api/src/index.ts`
- `packages/api/src/test/`
- `packages/api/examples/bootstrap-issuer-did.ts`
- `packages/api/README.md`

## Typical callers

- integration tests
- custom automation using funded Midnight wallets
- issuer bootstrap scripts that need a DID, Ed25519 authentication key, and
  SchnorrJubjub assertion key

## API surface

The public API is exported from `packages/api/src/index.ts`.
Run `pnpm run docs:api` locally when you need generated TypeDoc pages.
Use [API Examples](/packages/api-examples#bootstrap-an-issuer-did) for a
complete runnable issuer DID bootstrap flow.
