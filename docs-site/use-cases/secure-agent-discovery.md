# Secure Agent Discovery

## Fit

Partial but practical.

## Why it fits

The current DID model already supports the two main primitives needed for agent discovery:

- `service`
- `keyAgreement`

That is enough to publish discoverable service endpoints and key-agreement material.

## What works now

- resolving a DID to discover service endpoints
- publishing key-agreement verification methods
- using the resolver service as a discovery entry point

## What is still external

- DIDComm or another messaging protocol
- mediation and routing logic
- a stable interoperable crypto profile for messaging

## Practical interpretation

Treat Midnight DID as the discovery and trust anchor layer, not as a full messaging stack.

## Main implementation anchors

- `domain/`
- `did/`
- `did-resolver-service/`
