# Controller recovery prototype

Status: research prototype; not a normative method change yet. See also [ADR: Controller Recovery Authority](/architecture/adr-controller-recovery-authority).

## Problem

The current DID contract has one controller public key. If the matching wallet-local controller secret is lost, the DID remains resolvable but cannot be updated, rotated, or deactivated. PR #328 documented this explicitly.

## Options considered

### A. Add `recoveryAuthorityPublicKey`

Add one ledger field, `recoveryAuthorityPublicKey: JubjubPoint`, initialized from wallet private state at deployment. Add one narrowly scoped circuit:

- `recoverControllerKey(newControllerPublicKey, recoverySignature, expectedVersion)`

The recovery signature is checked against `recoveryAuthorityPublicKey` and can only replace `controllerPublicKey`. It cannot mutate DID document data, services, verification methods, relationships, or deactivation state.

Pros:

- Minimal ledger/state growth: one extra point.
- Minimal circuit/API surface: one recovery-only mutation.
- Clear operational model: keep the recovery secret offline/cold; use it only to recover the hot controller.
- Avoids adding multi-controller policy semantics to every mutating circuit.

Cons:

- Still single recovery secret; loss of both controller and recovery secrets freezes the DID.
- Recovery key custody and backup remain application/wallet responsibilities.
- If the recovery secret is compromised, attacker can rotate the controller key. Monitoring and post-recovery rotation guidance are needed.

### B. Store `Vector<4, JubjubPoint>` controller keys

Replace the single `controllerPublicKey` with several controller public keys and accept a valid signature from any configured slot.

Pros:

- Can model primary/backup operators with no separate recovery circuit.
- Simple 1-of-N availability if multiple parties hold keys.

Cons:

- Every controller-gated circuit must verify membership/signature against several keys or receive a key slot and enforce slot validity.
- Policy semantics are ambiguous: is it 1-of-4 active control, recovery-only keys, or multi-operator control?
- Increases public correlation surface and operational risk; any one active key can mutate everything.
- Threshold or social recovery would still not be solved; it would be off-chain policy over a 1-of-N on-chain primitive.

## Recommendation

Prefer option A for a first method-level recovery feature: a dedicated `recoveryAuthorityPublicKey` with a recovery-only circuit. It solves the documented catastrophic controller-secret-loss problem without turning the DID method into a multi-controller policy system.

If multi-party governance is required later, add it deliberately as a separate method version or policy layer rather than overloading recovery.

## Prototype shape in this branch

This branch prototypes option A:

- contract ledger adds `recoveryAuthorityPublicKey`
- constructor initializes it from `localRecoveryAuthorityPublicKey()`
- new pure digest: `recoverControllerKeyAuthorizationDigest(...)`
- new circuit: `recoverControllerKey(...)`
- private state can carry `recoverySecretKey`
- API exports `recoverControllerKey(...)`

The prototype intentionally does **not** add recovery-key rotation, threshold recovery, social recovery, or multiple active controller keys.

## Open design questions before productionizing

1. Should recovery key rotation be controller-gated, recovery-gated, or both?
2. Should deployment require a recovery key distinct from the controller key?
3. Should recovery events be highlighted in resolver metadata or only observable as ledger state transitions?
4. Should SDKs force an explicit backup acknowledgement before deploying with recovery enabled?
5. Does adding one new exported circuit and one ledger field fit current artifact/block-size constraints for the next method version?
