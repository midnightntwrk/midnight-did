# Compact Contract Surface

The Compact contract stores Midnight DID state and proves controller-authorized
state transitions. The TypeScript API exposes ergonomic add/update/remove
helpers, but the contract intentionally keeps the exported circuit count small.

## Contract Responsibilities

The contract enforces:

- controller authorization through wallet-local Jubjub Schnorr signatures;
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
| `rotateControllerKey` | `rotateControllerKey` | `controllerPublicKey`, `updated`, `version` | Replaces the controller Jubjub public key with a locally derived public key |
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

## Circuit Artifact Profile

The following profile is generated from the managed DID artifacts compiled with
Compact toolchain `0.30.0`. The `k` and row values come from `zkir compile -v`;
artifact sizes are byte sizes for files under
`packages/contract/src/managed/did`.

| Circuit | k | rows | prover key | verifier key | bzkir | zkir |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `rotateControllerKey` | 11 | 1,840 | 688,661 B | 1,591 B | 681 B | 10,113 B |
| `setVerificationMethod` | 12 | 2,161 | 1,348,160 B | 1,591 B | 1,336 B | 18,133 B |
| `removeVerificationMethod` | 11 | 1,831 | 688,870 B | 1,591 B | 1,056 B | 16,187 B |
| `setSchnorrJubjubVerificationMethod` | 11 | 2,030 | 689,482 B | 1,591 B | 1,191 B | 16,426 B |
| `removeSchnorrJubjubVerificationMethod` | 11 | 1,831 | 688,833 B | 1,591 B | 1,050 B | 16,142 B |
| `verifySchnorrJubjubDigestSignature` | 11 | 1,608 | 687,799 B | 1,591 B | 381 B | 4,847 B |
| `setVerificationMethodRelation` | 12 | 2,446 | 1,351,617 B | 1,591 B | 2,825 B | 36,577 B |
| `setService` | 11 | 1,991 | 689,327 B | 1,591 B | 1,037 B | 14,595 B |
| `removeService` | 11 | 1,806 | 688,589 B | 1,591 B | 699 B | 10,019 B |
| `setAlsoKnownAs` | 11 | 1,974 | 689,247 B | 1,591 B | 1,086 B | 14,730 B |
| `deactivate` | 11 | 1,804 | 688,590 B | 1,591 B | 670 B | 9,955 B |

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

See [Key Model](/guide/key-model) for the supported key profiles and controller
authorization signature model.

## Ledger-Bound SchnorrJubjub Verification

`verifySchnorrJubjubDigestSignature` accepts a verification method id, private
digest, and private signature. The private circuit inputs are the digest and
signature, not the controller secret. It reads the public key from
`schnorrJubjubVerificationMethods`, so the proof is tied to the current DID
ledger state instead of a caller-supplied public key.
