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

## Relationship To Other Packages

- `credentials`: generic VC/VP, proofs, holder bindings, protocol abstractions
- `credentials-same-holder`: reusable same-holder composition capability
- `credentials-iso-registry`: shared numeric ISO code types
- `credentials-passport`: shared passport claim family and explicit-holder variant

## Validation

```sh
npm run all -w credentials-passport-secret
npm run test:integration -w credentials-passport-secret
```
