# `credentials-passport-secret`

Hidden-holder passport credential family for Midnight Credentials.

## Purpose

This package is the privacy-oriented passport variant built on top of:

- the generic Midnight VC/VP core
- the shared ISO registry
- the explicit passport claim model
- the same-holder capability package

It supports:

- blinded secret holder binding
- verifier-scoped pseudonyms
- nationality and gender disclosure
- age-over-threshold predicate
- expiry validation
- same-holder composition across two or three secret passport credentials
- Compact-generated issuance and verification protocol message families
- typed Compact payload codecs for OpenID-shaped transport envelopes:
  - `encodeSecretPassportCredential(...)`
  - `encodeSecretPassportPresentation(...)`
  - `encodeSecretPassportProof(...)`

## Relationship To Other Packages

- `credentials`: generic VC/VP, proofs, holder bindings, protocol abstractions
- `credentials-same-holder`: reusable same-holder composition capability
- `credentials-iso-registry`: shared numeric ISO code types
- `credentials-passport`: shared passport claim family and explicit-holder variant
- `credentials-openid`: Compact value framing used by the typed transport codecs

## Compact Entry Points

- `src/secret-passport-credential.compact` is the standalone entry point used
  for this package's generated TS/JS artifacts and single-family tests.
- `src/secret-passport-credential/composable.compact` is the Layer 3 entry point
  for business contracts that compose multiple credential families. The Layer 3
  contract must include shared dependencies such as `credentials-same-holder`
  and `credentials-iso-registry` once before including this file.

## Validation

```sh
npm run all -w @midnight-ntwrk/midnight-did-credentials-passport-secret
npm run test:integration -w @midnight-ntwrk/midnight-did-credentials-passport-secret
```
