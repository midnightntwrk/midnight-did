# Domain Package

`@midnight-ntwrk/midnight-did-domain` is the canonical TypeScript layer for DID document validation and normalization.

## Focus

- DID schemas
- validation
- canonicalization
- domain-level types and codecs

## Use it when

- you need to parse or validate incoming DID documents
- you need canonical absolute DID URL references
- you want a runtime-agnostic package with no node/indexer/proof-server dependency

## Main repository paths

- `packages/domain/src/did-document.ts`
- `packages/domain/src/midnight.ts`
- `packages/domain/README.md`

## API surface

The public API is exported from `packages/domain/src/index.ts`.
Run `pnpm run docs:api` locally when you need generated TypeDoc pages.
