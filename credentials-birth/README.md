# @midnight-ntwrk/midnight-did-credentials-birth

Birth-credential specialization for the generic Midnight VC/VP core.

Related docs:

- spec: [`../research/midnight-credentials.md`](../research/midnight-credentials.md)
- companion guide: [`../research/midnight-credentials-for-dummies.md`](../research/midnight-credentials-for-dummies.md)

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

## Why this package exists

This package is the simplest concrete credential family in the repository.
Use it when you want to understand:

- how the generic VC/VP envelope becomes a real credential family
- how claim commitments are laid out for one schema
- how a verifier request and an age predicate are wired in practice

## Build and test

- Compile Compact artifacts: `npm run contract -w credentials-birth`
- Build TS exports: `npm run build -w credentials-birth`
- Run tests: `npm test -w credentials-birth`
