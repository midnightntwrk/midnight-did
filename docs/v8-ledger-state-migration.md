# v8 Ledger and State Migration Stance

## Purpose

This note records the repository stance after the Midnight SDK v8-compatible
ledger update. It is intentionally explicit so reviewers can tell whether a
pull request is preserving the current contract surface, adding a migration
utility, or accidentally implying compatibility that does not exist.

## Current stance

Legacy deployed DID state is not automatically migrated by this repository.

The current branch supports the current v8-compatible contract, API, resolver,
and CLI shape. Any DID contract deployed with an older ledger layout or the old
batched operation-dispatcher API is outside the supported runtime path until a
dedicated migration utility is designed, reviewed, and tested.

That means:

- New deployments use the current non-batched Compact circuits.
- Existing local fixtures and tests must use the current v8-compatible ledger
  shape.
- The API and resolver may accept DID Core shaped DTOs at their public boundary,
  but ledger-facing objects use the Compact-safe storage shape described below.
- Backward compatibility for already deployed pre-v8 DID contracts is explicitly
  unsupported in this branch.

## Ledger field shape

The Compact ledger structs use `typ` instead of `type`.

Reason: `type` is awkward at the Compact boundary and generated runtime types
already expose the storage field as `typ`.

Current ledger-facing examples:

```ts
const verificationMethod = {
  id: "#key-1",
  typ: VerificationMethodType.JsonWebKey,
  publicKeyJwk: {
    kty: "OKP",
    crv: "Ed25519",
    x: "Kg",
  },
};

const service = {
  id: "#service-1",
  typ: "DIDCommV2",
  serviceEndpoint: ["https://example.test/didcomm"],
};
```

Public DID Core DTOs still use `type`:

```json
{
  "id": "did:midnight:undeployed:abc#key-1",
  "type": "JsonWebKey",
  "controller": "did:midnight:undeployed:abc",
  "publicKeyJwk": {
    "kty": "OKP",
    "crv": "Ed25519",
    "x": "Kg"
  }
}
```

Boundary rule:

- API/CLI callers provide DID Core `type`.
- API/CLI conversion helpers map `type` to ledger `typ` before circuit calls.
- DID/resolver conversion helpers map ledger `typ` back to DID Core `type`.
- Tests may include legacy-looking fixture input only when the test explicitly
  proves the boundary mapping.

## Removed operation dispatcher API

The old batched operation-dispatcher model is not part of the current contract
surface.

`@midnight-ntwrk/midnight-did-contract` exports generated Compact circuits and
the `DIDPrivateState` witness type. It does not export the obsolete
`ledger-operation-builder` helper.

Migration expectation:

- Direct contract callers should call generated Compact circuits.
- Higher-level callers should use the API package helpers.
- Any future batched-operation abstraction must be introduced as a new adapter
  layer, not as a silent restoration of the removed contract helper.

## Non-batched circuit model

The current contract update model is decomposed into individual circuits:

- `addVerificationMethod`
- `updateVerificationMethod`
- `removeVerificationMethod`
- `addVerificationMethodRelation`
- `removeVerificationMethodRelation`
- `addService`
- `updateService`
- `removeService`
- `addAlsoKnownAs`
- `removeAlsoKnownAs`
- `deactivate`

Each operation increments ledger state independently. This is deliberate because
wallet and indexer state need time to synchronize between updates.

Reviewer rule:

- Do not assume an API call is one ledger operation.
- Do not combine relation and method removal into one Compact circuit unless a
  migration proposal explains wallet/indexer synchronization semantics.
- If a future PR introduces batching, it must include state-version assertions
  and integration timing evidence.

## Verification method removal semantics

`removeVerificationMethod` is intentionally two-phase.

Direct contract callers must remove relation references first, then remove the
verification method. The API helper preserves convenience behavior by issuing
relation-removal calls before the method-removal call.

Supported direct-contract sequence:

```ts
await contract.callTx.removeVerificationMethodRelation(
  VerificationMethodRelation.Authentication,
  "#key-1",
);
await contract.callTx.removeVerificationMethod("#key-1");
```

Unsupported direct-contract sequence:

```ts
await contract.callTx.removeVerificationMethod("#key-1");
```

when `#key-1` is still referenced by a verification relationship.

## Private-state type

The witness private-state type is `DIDPrivateState`.

The previous `MidnightDIDPrivateState` alias is not part of the current public
contract surface. Downstream consumers should update imports to:

```ts
import type { DIDPrivateState } from "@midnight-ntwrk/midnight-did-contract";
```

## Legacy deployment support matrix

| Artifact | Current support | Required path for support |
| --- | --- | --- |
| New v8-compatible DID deployment | Supported | Use current contract/API/CLI packages. |
| v8-compatible state with `typ` ledger fields | Supported | Use generated contract types and DID/resolver mappers. |
| DID Core DTOs with `type` at API boundary | Supported | Use API/CLI helpers that map to ledger `typ`. |
| Pre-v8 ledger state using old field shape | Unsupported | Needs explicit migration utility and fixtures. |
| Old batched operation dispatcher | Unsupported | Needs a new adapter proposal and tests. |
| `ledger-operation-builder` export | Removed | Use generated circuits or API helpers. |
| `MidnightDIDPrivateState` alias | Removed | Use `DIDPrivateState`. |

## What a future migration utility must include

A PR that claims legacy deployed DID support must include:

- fixture snapshots for at least one old-state contract and one migrated
  current-state contract;
- a deterministic field mapping from legacy `type` storage to current `typ`
  storage;
- operation-history or version semantics for non-batched updates;
- resolver behavior before and after migration;
- API/CLI dry-run diagnostics that tell operators whether a DID is unsupported,
  already current, or migration-ready;
- integration evidence against standalone infrastructure.

Until that exists, this repository should fail closed and state that legacy
deployed DID state is not automatically migrated.

## Evidence commands

Use these checks when reviewing PRs that touch contract state, mappers, or
generated contract exports:

```sh
npm run docs:check-v8-migration
npm run test -w contract
npm run test -w did -- src/test/ledger-to-domain.unit.test.ts
npm run test -w api -- src/test/lib.unit.test.ts
```

For full validation, use:

```sh
bash ./run.sh --skip-coverage
```
