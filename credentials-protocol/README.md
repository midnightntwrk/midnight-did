# `credentials-protocol`

Reference protocol orchestration layer for Midnight Credentials.

## Purpose

This package prototypes the off-chain party interactions around the Compact
credential circuits:

- issuer creates offers and issues credentials
- holder accepts offers and prepares presentations
- verifier requests presentations and evaluates them
- an in-process `MessageBus` models the transport seam between parties

The goal is to keep the protocol logic close to the Compact domain model and
exercise the generated message shapes in TypeScript before introducing real
transport adapters such as OID4VCI, OID4VP, SIOP, or DIDComm.

## What This Package Is

- a repo-local reference implementation
- a protocol simulation and conformance harness
- a place to test message shapes against Compact-generated circuits
- a bridge between Layer 2 credential families and Layer 3 business logic

## What This Package Is Not

- not a production-ready network transport library
- not yet a stable publishable API surface
- not a replacement for OIDC or DIDComm transports

The current public exports are intentionally narrow:

- explicit-holder and secret-holder agent classes
- shared crypto and envelope helpers
- the typed in-memory message bus transport seam

Test-only helpers remain under `src/test/helpers`.

## Current State

### Explicit-holder flows

Explicit-holder issuance and presentation flows use the Compact-generated
protocol message types from `credentials-birth` end to end. Tests validate:

- offer, request, and result message shapes
- response envelope threading
- request/result matching rules enforced by Compact circuits

### Secret-holder flows

Secret-holder presentation requests already use the Compact-generated request
shape from `credentials-birth-secret`.

Secret-holder issuance still uses package-local TypeScript message wrappers for
offer/request/result because the secret birth package does not yet expose the
full issuance protocol message family as Compact-generated types. Tests still
validate:

- generic protocol envelopes through the shared credentials circuits
- secret presentation request bodies through `credentials-birth-secret`
- issued credential and proof validity through Compact circuits

## Where To Start

- `src/agents/issuer-agent.ts`
- `src/agents/holder-agent.ts`
- `src/agents/verifier-agent.ts`
- `src/agents/secret-issuer-agent.ts`
- `src/agents/secret-holder-agent.ts`
- `src/transport/message-bus.ts`

## Test Map

- `src/test/explicit-holder/issuance.test.ts`
- `src/test/explicit-holder/presentation.test.ts`
- `src/test/explicit-holder/full-lifecycle.test.ts`
- `src/test/secret-holder/issuance.test.ts`
- `src/test/secret-holder/presentation.test.ts`
- `src/test/secret-holder/pseudonym.test.ts`
- `src/test/secret-holder/same-holder.test.ts`
- `src/test/contract-verifier/age-gate.test.ts`
- `src/test/contract-verifier/capability-lifecycle.test.ts`

## Validation

Run the package in isolation:

```sh
npm run lint -w credentials-protocol
npm run typecheck -w credentials-protocol
npm run all -w credentials-protocol
```
