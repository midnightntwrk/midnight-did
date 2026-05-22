# Repository Boundaries

This repository owns the `did:midnight` method implementation and the
TypeScript packages needed to build, update, and resolve Midnight DID state.

Use this repository for:

- Compact DID contract changes.
- DID document schemas, validation, and canonicalization.
- Ledger-to-domain mapping and in-process DID resolver helpers.
- Wallet/provider/API orchestration for DID contract operations.
- DID package docs, generated API reference, local runners, and package
  tarball distribution.

Use sibling repositories for deployable products and higher-level protocols:

| Repository                                                                                            | Scope                                                                                                                     |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [`midnight-did-resolver`](https://github.com/midnightntwrk/midnight-did-resolver)                     | Resolver service, DID manager UI/backend, reusable secret storage, service runtime docs, and local key-custody workflows. |
| [`midnight-verifiable-credentials`](https://github.com/midnightntwrk/midnight-verifiable-credentials) | VC/VP primitives, credential families, status/revocation, BDD use cases, university flows, and standalone VC integration. |
| [`midnight-trust-registry`](https://github.com/midnightntwrk/midnight-trust-registry)                 | Trust-registry data model, registry governance, and trust-list integration.                                               |

## Resolver Wording

The DID package still exposes in-process resolver helpers that convert ledger
state into DID Core-compatible documents. Those helpers are part of this
repository because they define method semantics.

Deployable resolver services, HTTP APIs, manager workflows, and reusable secret
storage are not part of this repository. Docs-site pages should link to
`midnight-did-resolver` when they discuss those deployable components rather
than implying they live here.

## Change Rule

When a docs-site page mentions resolver services, DID manager flows, local key
custody, or secret storage:

1. Keep the DID method/package responsibility explicit.
2. Link the deployable component to
   [`midnight-did-resolver`](https://github.com/midnightntwrk/midnight-did-resolver).
3. Avoid adding local pages for moved service components.
