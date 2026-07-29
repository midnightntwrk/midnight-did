# Midnight DID Method Traits

This document summarizes how the Midnight DID method aligns with the [DID Method Traits](https://identity.foundation/did-traits/) maintained by the Decentralized Identity Foundation.

## Core Identifier Traits

| Trait | Status | Notes |
| --- | --- | --- |
| Deterministic / namespaced | ✔ | `did:midnight:{network}:{64-hex}` derived from contract address; avoids collisions across networks. |
| Self-certifying | △ | DID value is not derived from controller key; security anchored in on-chain contract + wallet-local controller signatures. |
| Ledger anchored | ✔ | All CRUD operations interact with Midnight ledger smart contract. |
| Method-specific syntax | ✔ | Defined in [Midnight DID Method §2](./midnight-method.md#2-midnight-did-syntax); conforms to [RFC3986] and [W3C-DID] requirements. |

## CRUD Lifecycle Traits

| Trait | Status | Notes |
| --- | --- | --- |
| Create | ✔ | Contract deployment creates DID state. |
| Read / Resolve | ✔ | `packages/did/src/ledger-to-domain.ts` reconstructs DID Document from ledger state. |
| Update | ✔ | Individual contract circuits handle adds/updates/removals with controller-signature authorization. |
| Deactivate | ✔ | Deactivation operation prevents further updates. |
| Recover | ✔ | Dedicated `recoveryAuthorityPublicKey` authorizes `recoverControllerKey` to rotate the active controller key. Threshold/social recovery and recovery-authority rotation remain outside this method version. |

## Verification Method Traits

| Trait | Status | Notes |
| --- | --- | --- |
| Key rotation / revocation | ✔ | `Add/Update/RemoveVerificationMethod` + relation ops. |
| Key type diversity | △ | Restricted to explicit JWK profiles ([RFC7517]) (OKP/Ed25519/X25519/BLS12381G1/BLS12381G2, EC/Jubjub/P-256/secp256k1). `publicKeyMultibase`/`Multikey` is unsupported in this method version. |
| Multi-controller keys | ✖ | The contract stores one active controller public key plus a recovery authority public key. Multi-controller or threshold custody remains outside the current method surface. |
| Relative key IDs | ✔ | Fragment identifiers supported (`#key-1`). |

## Service Endpoint Traits

| Trait | Status | Notes |
| --- | --- | --- |
| Service entry support | ✔ | `service` array with `id`, `type`, `serviceEndpoint`. |
| Endpoint formats ([CID-1.0]) | ✔ | Strings, objects, and arrays; JSON stored on-ledger. |
| Relative service IDs | ✔ | Fragment/relative URIs required. |
| Absolute external IDs | ✖ | Non-DID absolute URIs disallowed. |

## Controller / Authorization Traits

| Trait | Status | Notes |
| --- | --- | --- |
| Single controller | ✔ | Contract enforces single controller equal to DID. |
| Multi-controller | ✖ | Not supported on-chain. Recovery uses a dedicated authority that can only rotate the active controller key and does not act as a second active controller. |
| Delegated updates | ✔ | Wallet-local controller signatures authorize updates without revealing the controller secret to proof servers. |
| On-chain access control | ✔ | Circuits verify wallet-local controller signatures against `controllerPublicKey`; recovery verifies a narrow recovery signature against `recoveryAuthorityPublicKey`. |

## Operational Traits

| Trait | Status | Notes |
| --- | --- | --- |
| Batch operations | ✖ | One circuit call per operation (no batching). |
| Network portability | ✔ | Works on undeployed/devnet/testnet/mainnet/preview/preprod. |
| Privacy guidance | ✔ | Spec discourages PII on-chain; ZK witness protects updates. |
| Service discovery | ✔ | Indexers/resolvers dependent on Midnight network ([Midnight DID Method §10](./midnight-method.md#10-discoverability)). |

_Status icons:_ ✔ Supported · △ Partial support / restriction · ✖ Not supported.

[W3C-DID]: https://www.w3.org/TR/did-core/ "Decentralized Identifiers (DID) v1.0"
[RFC3986]: https://www.rfc-editor.org/info/rfc3986 "RFC 3986: Uniform Resource Identifier (URI): Generic Syntax"
[RFC7517]: https://www.rfc-editor.org/info/rfc7517 "RFC 7517: JSON Web Key (JWK)"
[CID-1.0]: https://www.w3.org/TR/cid-1.0/ "DIDComm Messaging v2.0: Core (CID 1.0)"
