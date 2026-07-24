# ADR: Controller Authorization Signatures

## Status

Accepted.

## Context

Earlier DID controller-gated circuits proved authorization by receiving the wallet's controller `localSecretKey` as a private witness and checking a ledger commitment. That kept the secret off ledger, but a delegated proof server still received enough witness material to authorize future controller-gated updates.

## Decision

Controller authorization now uses the existing Midnight-native Jubjub Schnorr verifier. The ledger stores a controller `JubjubPoint` public key. For each controller-gated mutation, the wallet signs a controller authorization digest before proving.

The digest is domain-separated with `midnight-did-ctrl-sig:v1` and binds:

- the DID contract id, and
- the current ledger `version` expected by the wallet.

The circuit verifies the supplied signature against the stored controller public key and rejects stale versions before applying the mutation. The controller secret remains wallet-local; the proof server receives only the signature, expected version, and public inputs required by the operation.

## Consequences

- Remote proof servers cannot replay an old controller authorization after a DID version change.
- Controller key rotation stores the next Jubjub controller public key; the replacement secret is never sent to the circuit.
- Operation-specific input binding remains intentionally out of scope for this slice to keep the Compact circuit surface small; callers must create a fresh authorization for the current version immediately before submitting the intended mutation.
