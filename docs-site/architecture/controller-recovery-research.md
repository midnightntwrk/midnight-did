# Controller recovery design

Status: implemented method feature. See also [ADR: Controller Recovery Authority](/architecture/adr-controller-recovery-authority).

## Problem

The DID contract has one active controller public key. If the matching wallet-local controller secret is lost, the DID remains resolvable but cannot be updated, rotated, or deactivated by ordinary controller-gated operations.

## Selected design: `recoveryAuthorityPublicKey`

The contract stores one dedicated `recoveryAuthorityPublicKey: JubjubPoint`, initialized from wallet private state at deployment. A narrowly scoped circuit recovers control:

- `recoverControllerKey(newControllerPublicKey, recoverySignature, expectedVersion)`

The recovery signature is checked against `recoveryAuthorityPublicKey` and can only replace `controllerPublicKey`. It cannot mutate DID document data, services, verification methods, relationships, aliases, deactivation state, or the recovery authority itself.

This is intentionally separate from DID Document verification methods: the recovery authority is method-level break-glass authority, not a DID verification method or a second active controller.

## Rationale

A separate recovery authority keeps everyday controller authorization simple while providing a production recovery path for catastrophic controller-secret loss.

Benefits:

- Minimal ledger/state growth: one extra Jubjub point.
- Minimal circuit/API surface: one recovery-only mutation.
- Clear operational model: keep the recovery secret offline/cold; use it only to recover the hot controller.
- No multi-controller policy semantics in every mutating circuit.
- Operation-bound signatures and expected-version checks prevent cross-operation reuse and stale replay.

## Alternatives considered

### Multiple active controller keys

Replacing the single `controllerPublicKey` with several controller public keys would allow 1-of-N controller authorization, but it would also require every controller-gated circuit to implement membership/policy logic. It blurs the distinction between everyday control and break-glass recovery, increases public correlation surface, and still does not provide threshold or social recovery by itself.

### Off-chain-only recovery

Wallet-only backup procedures are still required, but they do not help when the active controller secret is lost and no method-level recovery authority exists. The selected design preserves a narrow on-chain recovery path while keeping custody policy off-chain.

## Operational constraints

- The recovery authority is a single key. Loss of both controller and recovery secrets freezes the DID.
- Compromise of the recovery secret lets an attacker rotate the active controller key.
- The recovery authority cannot update the DID Document directly.
- The recovery authority cannot rotate itself in this method version.
- Multi-controller, threshold, and social recovery are out of scope for this method version and must be enforced by wallet/custody policy before producing a controller or recovery signature.

## API behavior

The SDK creates both `secretKey` and `recoverySecretKey` in private state at DID creation. `recoverControllerKey` can use a stored recovery secret or an explicitly supplied recovery secret. Explicitly supplied recovery secrets are used for the recovery call and are not newly persisted into active private state; an already stored recovery secret is preserved when it matches the on-ledger recovery authority and the recovered controller secret is promoted.
