<!--
  This file is part of midnightntwrk/midnight-did.
  Copyright (C) 2026 Midnight Foundation
  SPDX-License-Identifier: Apache-2.0
-->

# Offchain Midnight DID Extension Plan

## Issue

- [#73](https://github.com/midnightntwrk/midnight-did/issues/73)

## Goal

Define and implement an extension of the `did:midnight` method for lightweight,
self-contained, immutable identities that do not require on-ledger DID
contracts or resolver infrastructure.

## Canonical shape

Canonical DID subject:

```text
did:midnight:offchain:<state-hash>
```

Portable self-contained DID URL:

```text
did:midnight:offchain:<state-hash>?state=<base64url(canonical-compact-state)>
```

## Why this extension exists

This extension is meant for:

- demos
- local examples
- wallet prototypes
- Passport-style issuer/holder flows
- NightFi-style contract gating examples

It is not a replacement for the on-ledger Midnight DID method.

## Core design rules

1. The canonical DID subject stays query-free.
2. The `?state=` form is a DID URL used for portable self-contained resolution.
3. The method-specific id is the integrity hash of the serialized state.
4. The state is immutable.
5. The state is encoded as a Compact-native typed payload, not ad hoc JSON.

## Serialized state model

The first implementation slice uses a bounded Compact-native state model with:

- version
- alsoKnownAs entries
- verification methods
- verification relationships
- services

The bounds are intentionally small and prototype-oriented.

## Current implementation slice

Implemented on the feature branch:

- `MidnightNetwork.Offchain`
- offchain DID parsing in the domain layer
- Compact-native offchain state codec
- deterministic state hashing
- portable DID URL parsing and integrity validation
- DID Document derivation from self-contained state
- DID package facade for resolving portable offchain DIDs
- explicit rejection of `offchain` subjects by the ledger-backed resolver

## Remaining spec work

The full method extension spec should still define:

- exact Compact state schema and versioning policy
- byte-level framing and hash algorithm requirements
- service model constraints
- resolver behavior when `state` is absent
- representation and semantics of immutable metadata
- migration rules if a future `v2` state model appears

## Recommended follow-up order

1. land the first implementation slice for domain/parser/resolution
2. add spec prose for the method extension under repository docs/spec
3. add `OffchainMidnightHolderBinding` in Midnight VC once the state shape is stable
4. integrate the new profile into NightFi and Passport-style demos

## Relationship to Midnight VC

This extension does not remove the need for a lightweight key-bound holder
binding.

The recommended capability order remains:

1. `JubjubHolderBinding`
2. `OffchainMidnightHolderBinding`

The first capability solves lightweight prototype issuance and verification with
minimal moving parts. The second adds DID semantics on top of the same general
proof model.
