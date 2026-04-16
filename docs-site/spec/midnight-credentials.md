# Midnight Credentials

Version: `0.1-draft`

This page is the implementation-facing entry point for the Compact-first Midnight Credentials work in this repository.

## Canonical Documents

- `research/midnight-credentials.md`
- `research/midnight-credentials-for-dummies.md`

The research document remains the current working specification.
This page is the shorter portal entry for developers reading the docs site.

## What This Specification Covers

The current draft defines a Midnight-native VC/VP model that is designed for Compact contracts first.

It currently covers:

- typed credential and presentation envelopes
- issuer proofs over credential bodies
- holder proofs over presentation bodies
- explicit holder binding through Midnight DID verification methods
- hidden holder binding through holder-secret commitments
- selective disclosure from committed claims
- zero-knowledge predicates over hidden claims
- verifier-defined presentation requests
- verifier-domain pseudonyms
- same-holder composition as an optional capability package

## Why Compact-First

Midnight contracts need bounded, strongly typed structures.
That changes the design compared to JSON-first VC ecosystems.

The current model intentionally avoids:

- unbounded claim maps
- dynamic disclosure sets
- free-form JSON as the canonical contract shape

Instead, the model uses:

- fixed structs
- schema-specific claim layouts
- deterministic claim ordering
- explicit proof and disclosure boundaries

## Layered Architecture

The current design is split into five layers.

| Layer | Purpose | Current status |
| --- | --- | --- |
| Layer 1 | generic reusable VC/VP capabilities | implemented in `credentials`, `credentials-same-holder` |
| Layer 2 | concrete credential-family logic | implemented in `credentials-birth`, `credentials-birth-secret` |
| Layer 3 | business-contract composition | implemented in `credentials-demo-contract` |
| Layer 4 | application orchestration across contracts and off-chain flows | documented, not packaged yet |
| Layer 5 | governance and trust policy | acknowledged as future scope only |

This split matters because Midnight does not currently give us arbitrary smart-contract composability.
The repository therefore keeps reusable proof logic separate from business logic contracts.

Layer 5 is not part of the current implementation surface yet.
It is where a future trust registry or issuer/verifier policy layer would belong.

## Package Map

| Package | Responsibility |
| --- | --- |
| `credentials` | generic VC/VP envelope, proof helpers, explicit and secret holder-binding primitives |
| `credentials-same-holder` | optional same-holder capability for hidden-holder flows |
| `credentials-birth` | birth credential family with explicit DID-based holder binding |
| `credentials-birth-secret` | birth credential family with hidden holder binding |
| `credentials-demo-contract` | verifier-like business contract composed from the lower layers |

## Core Design Decisions

### Canonical proof suite

The current profile assumes Midnight Jubjub signatures as the canonical proof suite.
That keeps circuit logic smaller and avoids pretending the current prototype is proof-suite agnostic when it is not.

### Proofs are separate from VC and VP bodies

Proofs are kept outside the semantic credential and presentation structures.
That keeps the VC/VP body focused on business meaning, while the proof remains a cryptographic artifact derived from that body plus flow context.

### Holder binding is a capability, not one fixed model

The spec supports two holder-binding models:

- explicit DID-based holder binding
- hidden secret-based holder binding

Same-holder proofs are also kept as an optional capability package rather than forcing every credential family to carry that complexity.

## Compact Implementation Notes

The generic core currently focuses on:

- body-root derivation
- issuer proof verification
- presentation proof verification
- credential-to-presentation linkage
- explicit holder binding
- secret holder-binding primitives

Schema-specific packages then add:

- concrete claim commitment layouts
- disclosure rules
- family-specific predicates such as age checks
- optional capability composition such as same-holder proofs

## Current Example Flow

The repository currently demonstrates the pattern with a birth credential family.

Example capability chain:

1. issuer creates a birth credential with committed claims
2. holder prepares a presentation request for a verifier
3. holder discloses only selected data or proves a predicate such as `age >= threshold`
4. verifier contract accepts or rejects based on those circuit checks
5. business logic may then mutate state or mint a reusable access capability

## Where To Read Next

- Read [Midnight Credentials Explained](/spec/midnight-credentials-for-dummies) for a narrative introduction.
- Read [DID Management workspace](/services/did-management-workspace) if you want the UI side of identity operations.
- Read `research/midnight-credentials.md` in the repository for the full working draft.
