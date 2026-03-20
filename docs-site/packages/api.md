# API Package

`@midnight-ntwrk/midnight-did-api` is the runtime orchestration package used by CLI, tests, and service applications.

## Focus

- Midnight DID runtime orchestration
- wallet/provider setup
- DID contract lifecycle operations
- reusable programmatic interface for higher-level services

## Use it when

- you need to deploy or update Midnight DID contracts
- you need provider bootstrap for standalone or preprod flows
- you want the highest-level reusable programmatic API in this repository

## Main repository paths

- `api/src/lib.ts`
- `api/src/index.ts`
- `api/src/test/`
- `api/README.md`

## Full source doc

- [Embedded API README](/source/api-readme)

## Typical callers

- CLI application flow
- DID manager service
- integration tests
- custom automation using funded Midnight wallets

## API reference

- [Generated API package reference](/api/reference/api/)
