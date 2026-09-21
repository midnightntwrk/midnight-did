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
- you need to encode or decode fixed-width big-endian Jubjub JWK coordinates
  with `encodeJubjubJwkCoordinate` or `decodeJubjubJwkCoordinate`
- you want a runtime-agnostic package with no node/indexer/proof-server dependency

The Jubjub JWK helpers implement the Midnight DID 0.7 transport profile. They
are distinct from the minimal-width `FieldCodec`, enforce the Jubjub base-field
bound, and do not replace on-curve, subgroup, or identity-point validation.

## Main repository paths

- `packages/domain/src/did-document.ts`
- `packages/domain/src/midnight.ts`
- `packages/domain/README.md`

## API surface

The public API is exported from `packages/domain/src/index.ts`.
Run `pnpm run docs:api` locally when you need generated TypeDoc pages.
