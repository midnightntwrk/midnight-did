# ADR: Controller Recovery Authority

## Status

Accepted.

## Context

A Midnight DID has one active controller public key. Controller-gated
mutations are authorized by wallet-local Jubjub Schnorr signatures, so delegated
proof servers do not receive the controller secret. However, if the wallet loses
the controller secret, the DID remains resolvable but can no longer be updated,
rotated, or deactivated by the method itself.

The method needs a production recovery path for controller-secret loss without
turning every mutating circuit into a multi-controller policy engine.

Two recovery directions were considered:

1. store multiple active controller public keys and accept any controller
   signature; or
2. store a dedicated recovery authority public key that can only recover the
   active controller key.

Multiple active controllers would require every controller-gated circuit to grow
membership/policy logic, and it would blur the distinction between everyday DID
control and break-glass recovery. A 1-of-N controller set also does not provide
threshold or social recovery by itself; it only increases the number of keys that
can mutate the DID.

## Decision

Introduce a dedicated on-ledger `recoveryAuthorityPublicKey: JubjubPoint`. The
recovery authority is not a DID Document verification method and is not part of
the ordinary controller set. It is a narrow method-level authority used only by a
dedicated recovery circuit.

The recovery circuit shape is:

```text
recoverControllerKey(
  newControllerPublicKey: JubjubPoint,
  recoverySignature: SchnorrSignature,
  expectedVersion: Uint<64>,
)
```

The circuit verifies `recoverySignature` against `recoveryAuthorityPublicKey`
over a domain-separated authorization digest bound to:

- the DID contract id,
- the expected ledger version,
- the recovery operation name, and
- `newControllerPublicKey`.

If the signature and version are valid, the circuit replaces
`controllerPublicKey` with `newControllerPublicKey` and increments the DID
version. It must not mutate DID document content, verification methods,
verification relationships, services, aliases, deactivation state, or the
recovery authority itself.

Wallet/API private state may keep a `recoverySecretKey` alongside the active
controller `secretKey`. The SDK creates both secrets in one private-state record
by default. Recovery calls can also use an explicitly supplied recovery secret
without newly persisting that secret into active private state; an already
stored recovery secret is preserved only when it matches the on-ledger recovery
authority. Applications that require cold or separate recovery custody must add
that separation above the SDK storage layer.

## Consequences

- Loss of the active controller secret can be recovered without exposing that
  secret to a proof server.
- Recovery remains minimal: one extra Jubjub point on ledger and one dedicated
  circuit, instead of multi-controller policy logic in every mutating circuit.
- Compromise of the recovery secret lets an attacker rotate the active
  controller key, so custody guidance and monitoring are required.
- Loss of both controller and recovery secrets still makes the DID immutable.
- Recovery-authority rotation, threshold recovery, social recovery, and multiple
  active controllers remain out of scope for this decision and require separate
  ADRs/issues if needed.
