# Compact VC Profile Package

This directory defines a small, shared contract for Midnight VC fixtures:

- canonical schema identities
- stable envelope builder
- deterministic canonical hashing helper
- reproducible test vectors

## Canonical contract

- `schemas/compact-vc/src/index.mjs` exports:
  - `SCHEMA_REGISTRY`: known schema descriptors
  - `stableCanonicalJson(payload)` for deterministic JSON serialization
  - `compactVcCanonicalDigest(payload, encoding)` to compute SHA-256 over the canonicalized payload
  - `compactVcEnvelope({ schema, issuerDid, issuedAt, credential })` to produce a stable envelope

## Fixtures

Three canonical examples are shipped under `fixtures/`:

- `identity-credential.json`
- `role-credential.json`
- `compliance-credential.json`

`fixtures/hash-vectors.json` stores expected SHA-256 values for each example.

## Verification command

```bash
npm run test:vc-profile
```

The command runs the local contract test in `test/compact-vc-profile.test.mjs` and ensures
the fixtures remain stable.
