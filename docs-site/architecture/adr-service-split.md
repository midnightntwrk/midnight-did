# ADR: Resolver vs Manager Service Split

## Status

Accepted

## Context

The repository has two distinct service use cases:

- read-only DID resolution
- wallet-aware DID mutation and profile management

Combining both into one service would blur responsibilities and complicate deployment, security, and local development.

## Decision

Keep two separate services:

- `did-resolver-service`
  - read-only
  - indexer-backed
  - easy to expose publicly
- `did-manager-service`
  - single-user operator workflow
  - wallet and profile aware
  - intended for local/dev or carefully controlled environments

## Consequences

### Positive

- clearer operational boundary
- easier to harden the resolver independently
- manager can evolve around local state and wallet workflows without polluting the resolver contract

### Negative

- two services to configure and document
- shared visual language must be maintained separately

## Main implementation points

- `did-resolver-service/src/`
- `did-manager-service/src/`
- `docs-site/services/`
