# @midnight-ntwrk/midnight-did-credentials-birth-secret

Secret-holder-binding birth-credential specialization for the generic Midnight VC/VP core.

Related docs:

- spec: [`../research/midnight-credentials.md`](../research/midnight-credentials.md)
- companion guide: [`../research/midnight-credentials-for-dummies.md`](../research/midnight-credentials-for-dummies.md)

## Purpose

This package defines a birth-credential prototype that uses a hidden holder-binding secret instead of an explicit holder DID method reference.

It sits next to the explicit holder-binding package:

- [`../credentials-birth`](../credentials-birth/README.md): explicit DID-bound holder profile
- [`../credentials`](../credentials/README.md): generic VC/VP envelope and proof core
- [`../credentials-same-holder`](../credentials-same-holder/README.md): optional same-holder composition capability for hidden-holder flows

This package defines the secret-bound variant on top of the generic
[`credentials`](../credentials/README.md) package.

It owns the schema-specific parts that should not live in the generic core:

- birth claim commitments
- secret birth-credential schema validation
- typed secret birth-credential presentation requests
- secret holder-binding witness validation
- birth-country disclosure binding
- age-over-threshold predicate validation

## Relationship to the generic core

The generic package owns:

- proof container types
- DID method identifiers
- explicit and secret holder-binding primitives
- generic VC/VP envelope types
- generic proof-binding checks
- generic credential/presentation linking checks

This package owns:

- `BirthCredentialClaims`
- `SecretBirthCredentialDisclosures`
- `SecretBirthCredentialPresentationRequest`
- `SecretBirthCredentialIssuanceOffer`, `SecretBirthCredentialIssuanceRequest`, `SecretBirthCredentialIssuanceResult`
- `SecretBirthCredentialVerificationRequest`, `SecretBirthCredentialVerificationSubmission`, `SecretBirthCredentialVerificationResult`
- `SecretBirthCredential`
- `SecretBirthCredentialPresentation`
- birth-specific commitment helpers
- secret-holder-binding validation, request, and predicate circuits
- generated protocol message families built on the generic issuance / presentation protocol modules
- concrete same-holder composition for secret birth credentials by composing the dedicated same-holder capability package

## Prototype scope

This package proves that a credential can be bound to a hidden holder secret commitment and later satisfied with a private holder witness plus a verifier challenge.

What it does prove:

- issuer proof over the credential body
- matching secret holder-binding commitment between credential and presentation
- holder knowledge of the committed secret through a private witness
- challenge-bound response derived from the holder secret
- verifier-scoped pseudonym derivation from the hidden holder secret
- same-holder composition across two or three secret birth credentials when the verifier coordinates a shared challenge

What it does not yet prove:

- blind issuance of the holder secret
- revocation

## Why this package exists

This package demonstrates the privacy-oriented branch of the design:

- the issuer does not bind the credential to a public holder DID method
- the holder proves control through a hidden secret witness
- optional same-holder composition can be added without forcing every credential family to adopt it

## Build and test

- Compile Compact artifacts: `npm run contract -w credentials-birth-secret`
- Build TS exports: `npm run build -w credentials-birth-secret`
- Run tests: `npm test -w credentials-birth-secret`
