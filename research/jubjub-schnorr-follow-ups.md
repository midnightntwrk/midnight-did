# JubJub Schnorr Follow-ups

## Potential task: DID/API verification helper

Status:
- potential follow-up
- not required for the current shared `jubjub-schnorr` integration

## Goal

Add a higher-level verification helper above the contract and secret-storage
layers so application code can verify a DID-facing JubJub signature without
manually handling:

- payload-to-digest conversion
- 96-byte signature decoding
- JWK-to-JubJub point normalization
- internal package boundaries

## Proposed shape

Possible helper:

```ts
verifyJubjubDidSignature({
  publicJwk,
  payload,
  signature,
}): boolean
```

## Intended behavior

1. accept a `PublicJwk`, raw `payload`, and raw `signature`
2. normalize the JWK into a JubJub public key point
3. derive the canonical `Vector<4, Field>` payload digest
4. decode the 96-byte Schnorr signature
5. call the shared verifier exposed through `secret-storage`

## Candidate locations

- `did/`
  - good if this becomes part of the DID-domain utility surface
- `api/`
  - good if verification is mostly service-facing

## Why deferred

- current callers already have the correct public helper surface via
  `secret-storage`
- there is no concrete external caller in `did` or `api` yet
- adding another wrapper now would mostly duplicate the new shared surface

## Completion trigger

Implement this helper when a real caller appears outside `secret-storage`, or
when API/service code starts repeating the same payload/JWK/signature
normalization steps.
