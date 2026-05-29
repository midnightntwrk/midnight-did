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

## Identifier Rules

- Verification method ids may be relative fragments such as `#key-1`.
- The SDK normalizes ids before submitting ledger updates.
- Resolvers emit absolute DID URL ids in the DID Document.
- Relation sets may reference methods from either key map.

## Trusted Proof Server Model

Controller-gated update circuits use a private `localSecretKey` witness to prove
that the caller controls the DID. This protects the secret from the ledger,
indexers, resolvers, and DID Document readers.

It does not automatically protect the secret from a delegated proof server. If a
remote proof server receives the current controller secret, that server can learn
enough material to produce future controller proofs. For this method version,
wallets and SDKs must use one of these operating models:

- prove controller-gated operations locally, or
- delegate proving only to infrastructure trusted with the DID controller secret.

`rotateControllerKey` reduces exposure for the replacement secret by passing only
the next derived `controllerPublicKey` to the circuit. The current secret is
still the authorization witness for the rotation operation.

Future untrusted-prover designs should replace hash-preimage controller
authorization with in-circuit verification of a wallet-local signature over the
exact operation intent.
