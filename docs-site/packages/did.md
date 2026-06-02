# DID Package

`@midnight-ntwrk/midnight-did` sits between raw ledger state and domain DID documents.

## Focus

- ledger-to-domain conversion
- DID resolver helpers
- canonical DID document shaping for consumers

## Use it when

- you already have ledger state and need a DID Resolution Result
- you are implementing resolver behavior over indexer data
- you need method/network utilities for `did:midnight`

## Main repository paths

- `packages/did/src/ledger-to-domain.ts`
- `packages/did/src/index.ts`
- `packages/did/README.md`

## API surface

The public API is exported from `packages/did/src/index.ts`.
Run `pnpm run docs:api` locally when you need generated TypeDoc pages.
