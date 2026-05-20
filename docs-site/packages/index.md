# Packages

| Package | Responsibility |
| --- | --- |
| `@midnight-ntwrk/midnight-did-contract` | Compact DID contract and generated runtime artifacts. |
| `@midnight-ntwrk/midnight-did-jubjub-schnorr` | Shared JubJub Schnorr transcript and signing helpers. |
| `@midnight-ntwrk/midnight-did-domain` | DID schemas, validation, canonicalization, and method-specific domain types. |
| `@midnight-ntwrk/midnight-did` | Ledger-to-domain mapping and DID helpers. |
| `@midnight-ntwrk/midnight-did-api` | Wallet/provider/contract orchestration and DID operations. |

Secret storage moved to `midnight-did-resolver` because it is service/runtime key-custody infrastructure, not DID method state.
