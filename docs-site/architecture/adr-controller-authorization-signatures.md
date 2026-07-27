# ADR: Controller Authorization Signatures

## Status

Accepted.

## Context

Earlier DID controller-gated circuits proved authorization by receiving the wallet's controller `localSecretKey` as a private witness and checking a ledger commitment. That kept the secret off ledger, but a delegated proof server still received enough witness material to authorize future controller-gated updates.

## Decision

Controller authorization now uses the existing Midnight-native Jubjub Schnorr verifier. The ledger stores a controller `JubjubPoint` public key. For each controller-gated mutation, the wallet signs a controller authorization digest before proving.

The signed Schnorr message uses four field lanes:

1. a domain hash for `midnight-did-ctrl-sig:v1`,
2. a DID state hash over the DID contract id and wallet-expected ledger `version`,
3. an operation-name hash, and
4. an operation-arguments hash.

Each controller-gated circuit recomputes the operation and argument hashes from the public arguments it is about to apply before verifying the signature. The circuit verifies the supplied signature against the stored controller public key and rejects stale versions before applying the mutation. The controller secret remains wallet-local; the proof server receives only the signature, expected version, and public inputs required by the operation.

## Consequences

- Remote proof servers cannot replay an old controller authorization after a DID version change.
- Remote proof servers cannot reuse a controller authorization for a different controller-gated operation or mutated public arguments.
- Controller key rotation stores the next Jubjub controller public key; the replacement secret is never sent to the circuit.
