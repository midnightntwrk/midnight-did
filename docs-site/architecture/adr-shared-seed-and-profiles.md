# ADR: Shared Seed and Local Profiles

## Status

Accepted

## Context

The repository now supports:

- local secret storage workflows
- DID manager local profiles
- standalone and preprod flows
- session resume between runs

Without a clear rule for seed ownership, wallet funding and DID ownership would drift into separate state models and become hard to restore correctly.

## Decision

Use the same validated seed as the root of:

- Midnight wallet funding preparation
- DID ownership/session continuity
- profile-specific local persistence

Keep profiles as local named containers inside a backend-controlled setup (`standalone` or `preprod`).

## Consequences

### Positive

- funding and DID ownership stay aligned
- session resume is predictable
- preprod flows are easier to reason about
- secret-storage and manager can share the same mental model

### Negative

- profile state becomes more operationally important
- a compromised local profile affects both wallet and DID continuity
- multi-user deployment still requires a stronger model than the current single-user design

## Main implementation points

- `secret-storage/src/seed.ts`
- `did-manager-service/src/manager.ts`
- `did-manager-service/src/session-store.ts`
