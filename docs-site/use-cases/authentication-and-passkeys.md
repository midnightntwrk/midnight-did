# Authentication and Passkeys

## Fit

Strong near-term fit.

## Why it fits

The current implementation already supports:

- `P-256` verification methods
- `authentication` relationships
- DID resolution through the resolver package and resolver service
- key generation, signing, and verification in the local secret-storage flow

That is enough to use Midnight DID as the public trust anchor for passkey-backed authentication.

## Implementation pattern

1. Create a `P-256` key pair for the user.
2. Publish the public key in the DID document under `verificationMethod`.
3. Link the key through `authentication`.
4. During login, resolve the DID and verify the WebAuthn/assertion signature against the DID document key.

## What the repo already gives you

- DID document storage and resolution for `P-256`
- local key lifecycle support in `secret-storage`
- manager workflows for key publication
- resolver service for relying-party lookups

## What still needs to be built outside this repo

- WebAuthn registration/authentication ceremony handling
- relying-party session and account-linking logic
- attestation policy handling

## Main implementation anchors

- `secret-storage/`
- `did-manager-service/`
- `did-resolver-service/`
