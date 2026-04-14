# @midnight-ntwrk/midnight-did-credentials-birth

Birth-credential specialization for the generic Midnight VC/VP core.

## Purpose

This package defines the birth-credential family on top of the generic
[`credentials`](../credentials/README.md) package.

It owns the schema-specific parts that should not live in the generic core:

- birth claim commitments
- birth-credential schema validation
- typed birth-credential presentation requests
- birth-country disclosure binding
- age-over-threshold predicate validation

## Relationship to the generic core

The generic package owns:

- proof container types
- DID method identifiers
- holder binding
- generic VC/VP envelope types
- generic proof-binding checks
- generic credential/presentation linking checks

This package owns:

- `BirthCredentialClaims`
- `BirthCredentialDisclosures`
- `BirthCredentialPresentationRequest`
- `BirthCredential`
- `BirthCredentialPresentation`
- birth-specific commitment helpers
- birth-specific validation, request, and predicate circuits

## Build and test

- Compile Compact artifacts: `npm run contract -w credentials-birth`
- Build TS exports: `npm run build -w credentials-birth`
- Run tests: `npm test -w credentials-birth`
