# Compact Contract Surface

The Compact contract stores Midnight DID state and proves controller-authorized
state transitions. The TypeScript API exposes ergonomic add/update/remove
helpers, but the contract intentionally keeps the exported circuit count small.

## Contract Responsibilities

The contract enforces:

- controller authorization through the `localSecretKey` witness;
- active/deactivated state checks;
- exact ledger identifier existence and uniqueness;
- supported opaque JWK key/curve profiles;
- native SchnorrJubjub point storage;
- relation cleanup invariants where the operation requires it.

The SDK/domain/resolver layers enforce DID URL subject binding, fragment
normalization, DID Core object shape, service endpoint shape, JWK canonicality,
and resolved DID Document output.

## Circuit Map

| Circuit | API helper | Ledger fields | Mutation style |
| --- | --- | --- | --- |
| `rotateControllerKey` | `rotateControllerKey` | `controllerPublicKey`, `updated`, `version` | Replaces controller commitment with a locally derived public key |
| `setVerificationMethod` | `addVerificationMethod`, `updateVerificationMethod` | `verificationMethods` | `MapMutation.Insert` or `MapMutation.Update` |
| `removeVerificationMethod` | `removeVerificationMethod` | `verificationMethods`, relation sets | Remove after relation cleanup |
| `setSchnorrJubjubVerificationMethod` | `addSchnorrJubjubVerificationMethod`, `updateSchnorrJubjubVerificationMethod` | `schnorrJubjubVerificationMethods` | `MapMutation.Insert` or `MapMutation.Update` |
| `removeSchnorrJubjubVerificationMethod` | `removeSchnorrJubjubVerificationMethod` | `schnorrJubjubVerificationMethods`, relation sets | Remove after relation cleanup |
| `verifySchnorrJubjubDigestSignature` | `verifySchnorrJubjubDigestSignature` | Reads `schnorrJubjubVerificationMethods` | Non-mutating transaction-backed proof |
| `setVerificationMethodRelation` | `addVerificationMethodRelation`, `removeVerificationMethodRelation` | `authentication`, `assertionMethod`, `keyAgreement`, `capabilityInvocation`, `capabilityDelegation` | `SetMutation.Insert` or `SetMutation.Remove` |
| `setService` | `addService`, `updateService` | `services` | `MapMutation.Insert` or `MapMutation.Update` |
| `removeService` | `removeService` | `services` | Remove by id |
| `setAlsoKnownAs` | `addAlsoKnownAs`, `removeAlsoKnownAs` | `alsoKnownAs` | `SetMutation.Insert` or `SetMutation.Remove` |
| `deactivate` | `deactivate` | `active`, `deactivated`, `updated`, `version` | Final lifecycle transition |

## Why The Surface Is Small

Every exported Compact circuit produces proving/verifier artifacts and
contributes to deployment footprint. A symmetric add/update/remove circuit for
every API helper can exceed current standalone Midnight block limits.

The contract therefore exports compact set/toggle circuits and uses explicit
mutation enums instead of ambiguous booleans. The API can still expose natural
helpers such as `addVerificationMethod` and `updateVerificationMethod`; those
helpers map to the same circuit with the appropriate mutation value.

## Key Storage

Non-native JWK keys are stored as opaque canonical strings in
`verificationMethods`. SchnorrJubjub keys are stored as native `JubjubPoint`
values in `schnorrJubjubVerificationMethods`. Resolvers merge both maps into the
final DID Document.

See [Key Model](/guide/key-model) for the supported key profiles and the trusted
proof-server assumption.

## Ledger-Bound SchnorrJubjub Verification

`verifySchnorrJubjubDigestSignature` accepts a verification method id, private
digest, and private signature. It reads the public key from
`schnorrJubjubVerificationMethods`, so the proof is tied to the current DID
ledger state instead of a caller-supplied public key.
