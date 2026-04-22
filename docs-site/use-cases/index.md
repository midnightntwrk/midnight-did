# Use Cases

This section translates the broader Midnight DID use-case inventory into the subset that is credible for the current reference implementation.

## Selection rule

Included here:

- use cases already supported directly by the current repo
- use cases that can be built at the application layer on top of the current repo without requiring new Midnight platform capabilities

Deferred here:

- use cases that need new contracts, new proof circuits, trust registries, or broader composability that this repository does not yet implement

## Current shortlist

| Use case | Current fit | Why it belongs now |
|---|---|---|
| Authentication and passkeys | Strong near-term fit | `P-256` keys, `authentication`, resolver, and service-side flows already exist |
| VC signing and verification | Strong foundation | `assertionMethod` and off-chain signing support are present; VC profile still needs to be designed |
| Delegated agent authorization | Good near-term extension | `capabilityDelegation`, `capabilityInvocation`, and service endpoints are already part of the DID model |
| Secure agent discovery | Partial but practical | service endpoints and `keyAgreement` are present; messaging profile is still external |
| Midnight Passport Prototype | Executable prototype | exercises Midnight Credentials, OpenID-shaped issuance, wallet-held credentials, selective disclosure, verifier decisions, and settlement separation |

## Source basis

These pages are derived from the broader use-case document on the `use-cases` branch, filtered against the current implementation state.
