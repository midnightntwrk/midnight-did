# Midnight Credentials Delivery Design

Date: 2026-04-16

Status: Delivered and retained as historical design context

## Context

This document captured the delivery plan before the current branch gained:

- `credentials-protocol`
- `standalone-environment`
- `credentials-iso-registry`
- `credentials-passport`
- `credentials-passport-secret`
- standalone integration coverage for explicit-holder, secret-holder, and contract-verifier flows

Treat this file as the historical delivery plan. The current source of truth for
prototype scope is:

- `research/midnight-credentials.md`
- `research/midnight-credentials-for-dummies.md`
- `research/midnight-credentials-test-strategy.md`

## Delivery Scope

### In scope

1. Stabilize the current 5-package prototype (M0 — done)
2. Build an in-process protocol simulation layer with strict Issuer/Holder/Verifier boundaries
3. Integration tests exercising full issuance and verification flows across all profiles
4. Standalone Docker integration tests with real provisioned Midnight DIDs
5. Align the spec (`research/midnight-credentials.md`) and companion guide (`research/midnight-credentials-for-dummies.md`) to the delivered code

### Out of scope

- OID4VCI / OID4VP / SIOP protocol bindings (separate future milestone)
- Real HTTP transport between parties
- Full blind issuance protocol
- Revocation / status mechanism
- Layer 5 governance and trust registries
- Additional credential families beyond birth

## Milestones

| Milestone | Deliverable | Commit criteria |
|-----------|-------------|-----------------|
| M0 | Clean commit of current working state | 42 tests green, GPG-signed (done: `61f0bed`) |
| M1 | Protocol simulation layer + secret-holder protocol tests | All agent classes, message bus, and protocol-level tests green |
| M2 | Standalone integration tests with real DIDs | Full profile coverage at simulator and integration levels |
| M3 | Spec and companion guide aligned to code | All circuit references, test pointers, and flow descriptions match implementation |
| M4 | Final commit, PR-ready | All tests green, docs consistent, clean git history |

## Architecture

### Five-Layer Model

| Layer | Responsibility | Current packages |
|-------|---------------|------------------|
| 1 | Generic VC/VP capabilities | `credentials`, `credentials-same-holder` |
| 2 | Concrete credential families | `credentials-birth`, `credentials-birth-secret` |
| 3 | Business contract logic | `credentials-demo-contract` |
| 4 | Protocol orchestration | `credentials-protocol` (new) |
| 5 | Governance and trust policy | Future scope |

### Protocol Simulation Layer

#### Party Agents

Three agent types, each a TypeScript class with isolated private state:

**IssuerAgent**
- Owns: issuer DID, signing key, schema definitions
- Lifecycle: `createOffer() → receiveRequest() → issueCredential()`
- Never sees: holder secret, holder private witnesses

**HolderAgent**
- Owns: holder DID or holder secret (profile-dependent), credential store, witness data
- Lifecycle (issuance): `receiveOffer() → createRequest() → receiveCredential()`
- Lifecycle (presentation): `receiveVerificationRequest() → createPresentation() → receiveResult()`
- Never sees: issuer signing key, verifier evaluation logic

**VerifierAgent** (off-chain mode)
- Owns: verifier DID, requirement definitions, challenge generation
- Lifecycle: `createVerificationRequest() → receiveSubmission() → evaluateAndRespond()`
- Never sees: holder secret, holder witnesses, issuer signing key

**ContractVerifier** (on-chain mode)
- Wraps the `credentials-demo-contract` simulator
- The contract reconstructs requirements internally and verifies on-chain
- Used for age-gate and capability lifecycle tests

#### Message Bus

An in-process typed message queue that enforces party boundaries:

```typescript
interface MessageBus {
  send(from: PartyId, to: PartyId, message: ProtocolMessage): void;
  receive(party: PartyId): ProtocolMessage | undefined;
  waitFor(party: PartyId, messageType: string): Promise<ProtocolMessage>;
}
```

Design properties:
- Messages are typed protocol envelopes matching the Compact `ProtocolMessageEnvelope` model
- No shared mutable state between agents — messages are the only communication channel
- The bus is the seam where OID4VCI/DIDComm replaces in-proc routing in a future milestone
- Synchronous delivery for test determinism (no real async I/O)

#### Verifier-as-Contract Pattern

When the verifier is a smart contract:
- The holder reads contract policy (via `ageGateRequest()` or equivalent)
- The holder builds the presentation locally
- The holder submits directly to the contract circuit
- The contract verifies and produces a business outcome (capability, denial, state mutation)
- No message bus needed for the verification leg — the contract IS the verifier

This matches the Midnight architecture where contracts are passive and expose circuits, not message endpoints.

### Package Structure

```
credentials-protocol/
├── src/
│   ├── agents/
│   │   ├── issuer-agent.ts
│   │   ├── holder-agent.ts
│   │   ├── verifier-agent.ts
│   │   └── contract-verifier.ts
│   ├── transport/
│   │   ├── types.ts
│   │   └── message-bus.ts
│   ├── index.ts
│   └── test/
│       ├── helpers/
│       │   └── did-provider.ts
│       ├── explicit-holder/
│       │   ├── issuance.test.ts
│       │   ├── presentation.test.ts
│       │   └── full-lifecycle.test.ts
│       ├── secret-holder/
│       │   ├── issuance.test.ts
│       │   ├── presentation.test.ts
│       │   ├── pseudonym.test.ts
│       │   └── same-holder.test.ts
│       └── contract-verifier/
│           ├── age-gate.test.ts
│           └── capability-lifecycle.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### DID Provider

Two modes for test flexibility:

**Simulated DIDs** (default, fast)
- Generates synthetic `VerificationMethodRef` values with real Jubjub key pairs
- Used for protocol-level tests that need real cryptography but not on-chain DID resolution
- No Docker dependency

**Real Midnight DIDs** (standalone, Docker)
- Provisions DIDs through the `did-manager-service` API
- Requires proof server, indexer, DID manager service in Docker
- Tests tagged separately, excluded from default `npm test`
- Proves the full stack works end-to-end

### Package Dependencies

```
credentials-protocol
├── credentials              (Layer 1 — types, proofs, holder-binding helpers)
├── credentials-birth        (Layer 2 — explicit holder birth credential)
├── credentials-birth-secret (Layer 2 — secret holder birth credential)
├── credentials-same-holder  (Layer 1 — same-holder composition)
└── credentials-demo-contract (Layer 3 — business contract for ContractVerifier)
```

## Test Scenarios

### Explicit Holder Profile

| Test | Parties | Flow | Validates |
|------|---------|------|-----------|
| Issuance | Issuer ↔ Holder | Offer → Request → Issue credential | Protocol envelope threading, issuer proof binding, holder DID binding |
| Presentation | Holder ↔ Verifier | Request → Build presentation → Submit → Evaluate | Challenge binding, selective disclosure, age predicate |
| Full lifecycle | Issuer → Holder → Contract | Issue → present → age-gate → capability | End-to-end flow with contract verifier |

### Secret Holder Profile

| Test | Parties | Flow | Validates |
|------|---------|------|-----------|
| Issuance | Issuer ↔ Holder | Offer → Request (with secret commitment) → Issue | Blinded holder binding, issuer nonce |
| Presentation | Holder ↔ Verifier | Request → Build with hidden witness → Submit → Evaluate | Secret holder witness, challenge response |
| Pseudonym | Holder ↔ Verifier | Verifier requests domain pseudonym → Holder derives → Verifier validates | Verifier-scoped pseudonym derivation and verification |
| Same-holder | Holder ↔ Verifier | Two credentials from different issuers → shared challenge → same-holder proof | Cross-credential same-holder composition |

### Contract Verifier

| Test | Parties | Flow | Validates |
|------|---------|------|-----------|
| Age gate | Holder ↔ Contract | Read policy → build presentation → submit → verify on-chain | Contract-native verification, request satisfaction |
| Capability lifecycle | Holder ↔ Contract | Verify → issue capability → claim → reject re-claim | Capability issuance, consumption, soft denial |

## Spec and Guide Alignment (M3)

After M1 and M2 are green:

1. Audit every circuit name reference in `research/midnight-credentials.md` against the actual Compact source
2. Audit every test pointer in `research/midnight-credentials-for-dummies.md` against the actual test files
3. Add a new chapter to the companion guide covering the protocol simulation layer and party boundaries
4. Update the "Where To Start In The Code" section with the `credentials-protocol` package
5. Update the capability profile table to reflect any new or changed profiles

## Design Decisions

### Why a new package instead of extending credentials-demo-contract

The protocol simulation layer is reusable infrastructure, not demo-specific. Multiple credential families and business contracts should share the same agent and transport abstractions. Keeping it in `credentials-demo-contract` would couple the orchestration layer to one specific business contract.

### Why in-process message bus instead of HTTP

The protocol simulation layer is not the transport layer. Its job is to enforce party boundaries and prove the SSI flow works with real cryptography. Adding HTTP would conflate protocol correctness with transport correctness. The message bus is the seam where OID4VCI/DIDComm plugs in later without changing any agent logic.

### Why two verifier modes

Midnight's distinguishing architectural feature is that the verifier is often a smart contract. A generic off-chain verifier and a contract-based verifier have different interaction patterns — the off-chain verifier exchanges messages, the contract verifier accepts circuit calls. Both must be tested.

### Why simulated DIDs as default

Most protocol-level tests need real cryptographic operations but not real DID resolution. Running Docker for every test iteration slows development. Simulated DIDs give fast feedback on protocol correctness. Real DID tests run in a separate tagged suite for integration validation.
