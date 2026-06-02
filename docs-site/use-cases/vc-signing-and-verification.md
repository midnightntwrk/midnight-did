# VC Signing and Verification

VC/VP envelope, claims, status, and presentation protocol work lives in [`midnight-verifiable-credentials`](https://github.com/midnightntwrk/midnight-verifiable-credentials).

This DID repository contributes the DID method packages used by VC implementations:

- `packages/contract/` for DID state.
- `packages/domain/` for DID document validation.
- `packages/did/` for resolution helpers.
- `packages/api/` for DID operations.

Local key custody and service-side signing helpers live in [`midnight-did-resolver`](https://github.com/midnightntwrk/midnight-did-resolver).
