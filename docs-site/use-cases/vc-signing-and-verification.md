# VC Signing and Verification

## Fit

Strong foundation, but still application-layer work.

## Why it fits

The DID method already supports the main DID primitive needed for issuer signing:

- `assertionMethod`

The current repo also already supports off-chain key generation and signature verification for:

- `Ed25519`
- `P-256`
- `Jubjub`

## Realistic scope today

What is realistic today is:

1. publish issuer keys in a Midnight DID document
2. sign compact credential payloads off-chain
3. resolve issuer DIDs and verify signatures

## What is not yet in this repo

- a VC data model
- a compact-friendly credential profile
- credential revocation/status infrastructure
- issuance and verification SDKs above raw signing

## Recommended direction

Start with a compact credential profile that prefers:

- hashes and stable identifiers
- fixed-size fields or numeric encodings
- off-chain human-readable payloads with deterministic canonical hashing

## Main implementation anchors

- `domain/`
- `did/`
- `api/`
- `secret-storage/`
