# Key Model

Midnight DID has two key-storage paths because W3C interoperability and
Midnight-native cryptography need different ledger representations.

## Supported Keys

| Key profile | DID Document form | Ledger storage | API helper | Sign/verify path |
| --- | --- | --- | --- | --- |
| Ed25519 | `publicKeyJwk` with `kty: "OKP"` and `crv: "Ed25519"` | Opaque canonical JWK strings | `addVerificationMethod` | Off-chain Ed25519 libraries |
| X25519 | `publicKeyJwk` with `kty: "OKP"` and `crv: "X25519"` | Opaque canonical JWK strings | `addVerificationMethod` | Key agreement outside the DID contract |
| P-256 | `publicKeyJwk` with `kty: "EC"` and `crv: "P-256"` | Opaque canonical JWK strings | `addVerificationMethod` | Off-chain P-256 libraries |
| secp256k1 | `publicKeyJwk` with `kty: "EC"` and `crv: "secp256k1"` | Opaque canonical JWK strings | `addVerificationMethod` | Off-chain secp256k1 libraries |
| BLS12-381 G1/G2 | `publicKeyJwk` with `kty: "OKP"` and `crv: "BLS12381G1"` or `"BLS12381G2"` | Opaque canonical JWK strings | `addVerificationMethod` | BLS/BBS-compatible libraries outside the DID contract |
| SchnorrJubjub | Resolved as `publicKeyJwk` with `crv: "Jubjub"` | Native `JubjubPoint` in `schnorrJubjubVerificationMethods` | `addSchnorrJubjubVerificationMethod` | `verifySchnorrJubjubDigestSignature` reads the key by method id from ledger state |

## Why Two Maps Exist

The contract stores non-native JWK keys as opaque strings in
`verificationMethods`. These keys are meant for DID Document interoperability;
the contract validates the supported key profile but does not parse arbitrary
base64url coordinates into cryptographic values.

SchnorrJubjub keys are different. Midnight-native verification needs a real
`JubjubPoint`, so the contract stores those keys in
`schnorrJubjubVerificationMethods`. The resolver merges both maps into one DID
Document `verificationMethod` array.

The two maps are not duplicate storage. A verification method id belongs to
exactly one map. Keeping one canonical representation per key avoids consistency
bugs while still supporting both W3C JWK output and native Midnight proofs.

`publicKeyJwk` values are validated with profile-specific byte lengths: 32 bytes
for Ed25519, X25519, P-256, and secp256k1; 48 bytes for BLS12381G1; and 96
bytes for BLS12381G2. Public JWKs must not include private `d` material.

`publicKeyMultibase` / `Multikey` is not a Midnight DID ledger profile in this
method version. Data Integrity and BBS-oriented suites that require Multikey are
not currently consumable through `did:midnight` without a separate method
extension or integration-layer adaptation.

## Identifier Rules

- Verification method ids may be relative fragments such as `#key-1`.
- The SDK normalizes ids before submitting ledger updates.
- Resolvers emit absolute DID URL ids in the DID Document.
- Relation sets may reference methods from either key map.

## Verification Relationship Compatibility

Midnight DID enforces DID Core relationship intent at the SDK and contract
boundary. Signing-capable curves (`Ed25519`, `P-256`, `secp256k1`,
`BLS12381G1`, `BLS12381G2`, and native `SchnorrJubjub`) may be placed in
`authentication`, `assertionMethod`, `capabilityInvocation`, and
`capabilityDelegation`. They must not be placed in `keyAgreement`.

`X25519` is the key-agreement profile. It may be placed in `keyAgreement` and
must not be placed in signing verification relationships.

## Controller Authorization Signature Model

Controller-gated update circuits verify a wallet-local Jubjub Schnorr signature
instead of receiving the controller secret as a witness. The ledger stores the
controller `JubjubPoint` public key. For each mutation, the SDK signs a
domain-separated authorization digest containing the DID contract id, current
ledger version, operation name, and operation arguments, then passes the
signature and expected version to the circuit.

This keeps the controller secret out of the ledger, indexers, resolvers, DID
Document readers, and delegated proof servers. A remote proof server receives
only signature material and the public operation inputs needed to prove the
transaction. Replayed authorizations fail after the DID version changes, and
operation-bound signatures cannot be reused for a different mutation or changed
arguments.

`rotateControllerKey` accepts only the next derived `controllerPublicKey`; the
replacement secret remains wallet-local and is promoted after finalization.

## Controller Recovery and Backup Posture

The current DID contract has one controller public key and no on-method recovery
or threshold-controller circuit. Losing the controller secret freezes the DID in
its last public state: it can still be resolved, but no controller-gated update,
rotation, service change, verification-method change, or deactivation can be
performed.

Back up the controller private state before using a DID for production control.
For organizational DIDs, treat backup, custody rotation, and operator access as
application responsibilities outside this method version. If an organization
needs multi-person recovery or threshold authorization today, it should place
that policy in the wallet/custody layer and only submit a controller signature
after the off-chain policy approves the operation.

Deactivation is not recovery. It is irreversible, prevents future updates, and
does not erase public ledger history or previously resolved DID Document data.
Use controller rotation before compromise or personnel loss whenever recovery of
control is still possible.
