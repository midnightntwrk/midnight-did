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
- `packages/api/README.md`

## Full source doc

- [Embedded API README](/source/api-readme)

## Typical callers

- integration tests
- custom automation using funded Midnight wallets

## API reference

- [Generated API package reference](/api/reference/api/)
