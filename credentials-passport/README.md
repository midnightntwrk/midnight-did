# `credentials-passport`

Explicit-holder passport credential family for Midnight Credentials.

## Purpose

This package extends the generic Midnight VC/VP core with a passport-shaped
credential that supports:

- issuer-attested passport claim commitments
- explicit DID-based holder binding
- nationality disclosure
- gender disclosure
- age-over-threshold predicate
- expiry validation
- Compact-generated issuance and verification protocol message families

It is the first non-birth credential family in the prototype and validates that
the generic VC/VP and protocol layer can be reused across multiple schemas.

## Relationship To Other Packages

- `credentials`: generic VC/VP, proofs, holder bindings, protocol abstractions
- `credentials-iso-registry`: shared numeric ISO code types
- `credentials-passport-secret`: same family with blinded secret holder binding

## Validation

```sh
npm run all -w credentials-passport
npm run test:integration -w credentials-passport
```
