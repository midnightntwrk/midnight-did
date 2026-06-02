# Authentication and Passkeys

`did:midnight` supports authentication-oriented DID documents through verification methods and authentication relationships in the core contract/domain/API packages.

Implementation surfaces in this repository:

- `packages/contract/` for on-ledger verification method state.
- `packages/domain/` for DID Core validation and canonicalization.
- `packages/did/` for ledger-to-DID document mapping.
- `packages/api/` for publishing DID updates.

Service-side key custody, resolver HTTP APIs, and manager workflows live in [`midnight-did-resolver`](https://github.com/midnightntwrk/midnight-did-resolver).
