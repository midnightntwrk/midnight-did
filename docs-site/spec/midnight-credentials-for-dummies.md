# Midnight Credentials Explained

Version: `0.1-draft`

This page is the reader-friendly companion to [Midnight Credentials](/spec/midnight-credentials).

If the specification feels too dense, start here.

## The Short Version

Midnight Credentials answer a simple question:

How can a holder prove something useful to a verifier contract without exposing more than necessary?

The current prototype does that with:

- typed Compact credential structures
- commitments for hidden claims
- proofs over credential and presentation bodies
- optional selective disclosure
- optional zero-knowledge predicates such as age thresholds
- optional same-holder proofs across multiple credentials

## Cast Of Characters

- Alice: the holder
- Rita: the issuer
- Vera: the verifier
- Mohawk: the engineer who keeps turning edge cases into reusable capabilities

## Story: Start Simple

Rita wants to issue Alice a birth credential.
The raw claims are not stored as open JSON in the contract-facing model.
Instead, the holder and verifier work with commitments and typed structures.

That gives us two useful properties immediately:

- strong typing for Compact
- privacy boundaries that are explicit in the model

## The Problem That Appears Next

Vera does not always need the full birth credential.
Sometimes she only needs one of these:

- country of birth
- proof that Alice is over 18
- proof that two different credentials belong to the same holder

That is why the model is built out of capabilities instead of one monolithic credential format.

## The Five Layers

| Layer | Plain-language meaning |
| --- | --- |
| Layer 1 | reusable building blocks |
| Layer 2 | one concrete credential family |
| Layer 3 | business smart-contract rules |
| Layer 4 | off-chain orchestration between contracts and apps |
| Layer 5 | future governance and trust policy |

In the current repository:

- Layer 1 lives in `credentials` and `credentials-same-holder`
- Layer 2 lives in `credentials-birth` and `credentials-birth-secret`
- Layer 3 lives in `credentials-demo-contract`
- Layer 4 is documented, but not packaged yet
- Layer 5 is acknowledged, but intentionally abstract for now

## Capability Progression

The current prototype grows step by step.

### 1. Simple explicit holder binding

The credential says who issued it and which holder DID method it belongs to.
This is the easiest model to read and debug.

### 2. Selective disclosure

The holder can reveal only the claim material required by the verifier request.

### 3. Predicate proofs

The holder can prove a condition over hidden data, for example:

- `age >= 18`

without revealing the underlying birth date directly.

### 4. Hidden holder binding

The holder does not need to reveal a public DID method as the binding anchor.
Instead, the credential can be tied to a secret holder commitment.

### 5. Same-holder capability

Two separate presentations can prove that they are controlled by the same hidden holder without forcing the business contract to invent a new universal bundle format first.

## Why This Is Not Just W3C VC In Compact Clothing

The design borrows from SSI ideas, but it is not a JSON-first VC model translated into Compact.

The main differences are:

- Compact types come first
- schemas are fixed and bounded
- disclosure is modeled as circuit logic
- verification is designed for smart contracts, not just web verifiers

That makes the model stricter, but also easier to consume from Midnight contracts.

## What To Read In The Code

If you want the real implementation path:

- generic envelopes and proof helpers: `credentials/src/credentials.compact`
- same-holder capability: `credentials-same-holder/src/same-holder.compact`
- explicit birth credential family: `credentials-birth/src/birth-credential.compact`
- hidden-holder birth family: `credentials-birth-secret/src/secret-birth-credential.compact`
- business logic composition: `credentials-demo-contract/src/demo.compact`

## What To Read In Tests

The tests are intentionally split by capability so you can learn one idea at a time.

- generic proof context: `credentials/src/test/proof-context.test.ts`
- secret holder binding: `credentials/src/test/secret-holder-binding.test.ts`
- same-holder capability: `credentials-same-holder/src/test/same-holder-capability.test.ts`
- birth family capability profiles: `credentials-birth/src/test/capability-profiles.test.ts`
- hidden-holder birth capability profiles: `credentials-birth-secret/src/test/capability-profiles.test.ts`

## Read This Next

- Read [Midnight Credentials](/spec/midnight-credentials) for the formal structure and decisions.
- Read the repository file `research/midnight-credentials-for-dummies.md` for the longer narrative version with more context.
