# Deferred Use Cases

These use cases came from the broader Midnight DID use-case inventory, but they are intentionally not being presented as current implementation guidance because they depend on significant missing pieces.

## Deferred for now

| Use case | Why deferred |
|---|---|
| Multi-sig collaborative approvals | needs a separate governance or multi-sig contract |
| DID trust registry | needs a new registry contract and governance model |
| ZKP age verification | needs credential profile design, proof circuits, and contract verification integration |
| Regulated finance / RWA access control | depends on VC and trust-registry layers not yet implemented here |
| Reusable KYC/compliance credentials | depends on VC schema/proof/status layers |
| Healthcare and medical attestations | depends on credential, policy, and selective-disclosure layers |
| Record provenance and compliance evidence | depends on signed attestation/credential application layers |

## Why this page exists

The goal is to keep the docs technically honest. These are good Midnight DID directions, but they should not be written as if the current branch already supports them end to end.

## Revisit rule

Move a deferred use case into the main section only when the repository has at least:

- the necessary DID primitives in place
- a credible application or SDK path
- no hidden dependency on missing platform-level capabilities
