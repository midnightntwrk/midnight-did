# Midnight DID Credentials Compliance

Prototype compliance credential family for sanctions screening attestations.

The package models a reusable `SanctionScreeningCredential` using the generic Midnight Credentials VC/VP layer with blinded secret holder binding. It is designed for wallet-gated flows where a holder proves:

- a screening result is `PASS`
- the PEP flag is false when requested
- screening is fresh enough for the verifier policy
- the credential is not expired
- the same hidden holder is bound to the presentation without revealing the holder DID

This is a prototype credential family used by the Midnight Passport experiments. It is not a production sanctions screening standard.

## Transport Codecs

The package exposes typed helpers for OpenID-shaped transport envelopes:

- `encodeSanctionScreeningCredential(...)`
- `encodeSanctionScreeningPresentation(...)`
- `encodeSanctionScreeningProof(...)`

These helpers use the `credentials-openid` Compact value framing internally, so
application code can carry binary Compact credential and presentation payloads
inside JSON envelopes without treating JSON as the canonical VC/VP format.
