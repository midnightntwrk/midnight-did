# Midnight DID Method Traits

This document summarizes how the Midnight DID method aligns with the [DID Method Traits](https://identity.foundation/did-traits/) maintained by the Decentralized Identity Foundation.

## Core Identifier Traits

| Trait | Status | Notes |
| --- | --- | --- |
| Deterministic / namespaced | ✔ | `did:midnight:{network}:{68-hex}` derived from contract address; avoids collisions across networks. |
| Self-certifying | △ | DID value is not derived from controller key; security anchored in on-chain contract + secretKey. |
| Ledger anchored | ✔ | All CRUD operations interact with Midnight ledger smart contract. |
| Method-specific syntax | ✔ | Defined in spec §2; conforms to RFC3986 and DID Core requirements. |

## CRUD Lifecycle Traits

| Trait | Status | Notes |
| --- | --- | --- |
| Create | ✔ | Contract deployment creates DID state. |
| Read / Resolve | ✔ | `did/src/ledger-to-domain.ts` reconstructs DID Document from ledger state. |
| Update | ✔ | `applyOperations` circuit handles adds/updates/removals. |
| Deactivate | ✔ | Deactivation operation prevents further updates. |
| Recover | △ | No explicit recovery; requires redeployment/new DID. |

## Verification Method Traits

| Trait | Status | Notes |
| --- | --- | --- |
| Key rotation / revocation | ✔ | `Add/Update/RemoveVerificationMethod` + relation ops. |
| Key type diversity | △ | Restricted to JWK (OKP/Ed25519, EC/Jubjub). |
| Multi-controller keys | ✖ | Controller must equal DID subject (single-controller model). |
| Relative key IDs | ✔ | Fragment identifiers supported (`#key-1`). |

## Service Endpoint Traits

| Trait | Status | Notes |
| --- | --- | --- |
| Service entry support | ✔ | `service` array with `id`, `type`, `serviceEndpoint`. |
| Endpoint formats (CID 1.0) | ✔ | Strings, objects, and arrays; JSON stored on-ledger. |
| Relative service IDs | ✔ | Fragment/relative URIs required. |
| Absolute external IDs | ✖ | Non-DID absolute URIs disallowed. |

## Controller / Authorization Traits

| Trait | Status | Notes |
| --- | --- | --- |
| Single controller | ✔ | Contract enforces single controller equal to DID. |
| Multi-controller | ✖ | Not supported. |
| Delegated updates | ✔ | Possession of contract `secretKey` required. |
| On-chain access control | ✔ | Updates validated by `applyOperations` circuit. |

## Operational Traits

| Trait | Status | Notes |
| --- | --- | --- |
| Batch operations | △ | Up to 4 operations per transaction. |
| Network portability | ✔ | Works on undeployed/devnet/testnet/mainnet. |
| Privacy guidance | ✔ | Spec discourages PII on-chain; ZK witness protects updates. |
| Service discovery | ✔ | Indexers/resolvers dependent on Midnight network (§11). |

_Status icons:_ ✔ Supported · △ Partial support / restriction · ✖ Not supported.
