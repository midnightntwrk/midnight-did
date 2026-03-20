# Delegated Agent Authorization

## Fit

Good near-term extension.

## Why it fits

The DID model already supports:

- `capabilityDelegation`
- `capabilityInvocation`
- service endpoints

That is enough to model a root organizational DID with separate operational keys or agent endpoints.

## Implementation pattern

1. Publish one or more operational verification methods.
2. Link them through `capabilityDelegation` or `capabilityInvocation`.
3. Publish the relevant agent endpoints in `service`.
4. Let clients resolve the DID and decide whether an agent is authorized for the requested operation.

## Good target scenarios

- issuer agent backends
- verifier gateway services
- status or revocation operators
- account-management services

## Main implementation anchors

- `domain/src/did-document.ts`
- `did/src/ledger-to-domain.ts`
- `did-manager-service/`
