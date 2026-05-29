# Libs

Use these packages when integrating or extending the Midnight DID reference
implementation.

| Package | Use when | Responsibility |
| --- | --- | --- |
| `@midnight-ntwrk/midnight-did-api` | You need wallet/provider setup and DID lifecycle operations. | High-level runtime facade over contract calls and resolution. |
| `@midnight-ntwrk/midnight-did` | You already have ledger state and need a DID Resolution Result. | Ledger-to-domain mapping and in-process resolver helpers. |
| `@midnight-ntwrk/midnight-did-domain` | You need runtime-agnostic DID validation and canonicalization. | DID schemas, method ids, DID URL normalization, and domain types. |
| `@midnight-ntwrk/midnight-did-contract` | You need Compact runtime artifacts or generated contract types. | Compact DID contract and generated runtime package. |
| `@midnight-ntwrk/midnight-did-jubjub-schnorr` | You need Midnight-native SchnorrJubjub signing helpers. | Shared Jubjub Schnorr transcript and signing helpers. |

Secret storage moved to
[`midnight-did-resolver`](https://github.com/midnightntwrk/midnight-did-resolver)
because it is service/runtime key-custody infrastructure, not DID method state.

Start with [API Reference](/api/) for the main exported API surface.
