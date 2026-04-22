# Midnight Credentials OpenID Domain Schemas

This package contains a small, transport-neutral TypeScript model inspired by
OID4VCI and OID4VP. It intentionally does not implement OAuth, HTTP routing,
DID resolution, JWT proof generation, or wallet UI behavior.

The goal is to keep Midnight-specific credential issuance and presentation flows
compatible with familiar OpenID message shapes while preserving the Compact
credential payloads, holder-binding commitments, and verifier-domain predicates
used by Midnight Credentials.

## Scope

- OID4VCI-style credential issuer metadata, credential offers, token requests,
  credential requests, and credential responses.
- OID4VP-style presentation definitions, authorization requests, presentation
  submissions, and authorization responses.
- Midnight extension schemas for Compact VC/VP payloads and holder-binding
  commitments.

## Non-goals

- OAuth server/client implementation.
- DIDComm or HTTP transport implementation.
- Cryptographic verification. Compact circuits and credential-family packages
  remain the source of truth for verification.

## Compact Value Codec

The package includes `compact-value-v1.base64url`, a small framing format for
Compact runtime `Value` payloads. The intended usage is:

1. Build the generated TypeScript value for a Compact VC/VP body or proof.
2. Encode it with `encodeCompactPayload(descriptor, value)`.
3. Carry the encoded payload in an OID4VCI/OID4VP-style JSON envelope.
4. Decode with `decodeCompactPayload(descriptor, encoded)` before verification.

The JSON envelope is transport metadata only. The Compact payload bytes remain
the source used to reconstruct typed values and recompute body roots.

Credential-family packages expose typed helpers around their own generated
descriptors so application code does not depend on generated private descriptor
constants. For example, the current prototype families expose helpers such as
`encodeSecretPassportCredential(...)`, `encodeSecretPassportPresentation(...)`,
and `encodeSanctionScreeningPresentation(...)`.

The transport envelopes use explicit payload names:

- `credential` for the Compact credential body.
- `credentialProof` for the issuer proof over the credential body.
- `presentation` for the Compact presentation body.
- `presentationProof` only when the holder-binding profile requires a separate
  holder-authenticated presentation proof. Hidden holder-secret profiles can
  authenticate the holder through the presentation holder-binding challenge
  response instead.
