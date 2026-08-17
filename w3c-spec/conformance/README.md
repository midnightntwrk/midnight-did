# Midnight DID W3C Conformance Evidence

**Phase status:** Phase 1 evidence audit plus the bounded Phase 2 DID syntax audit and method-boundary consistency follow-up; this is not a certification claim.
**Source of record:** [GitHub issue #405](https://github.com/midnightntwrk/midnight-did/issues/405), enriched from [`docs/W3C-COMPLIANCE-PLAN.md`](../../docs/W3C-COMPLIANCE-PLAN.md).

This area separates three questions:

1. DID Core data-model and method conformance;
2. DID Resolution envelopes, representations, metadata, negotiation, and errors; and
3. ecosystem interoperability (including private/provisional cryptographic profiles).

W3C does not certify individual DID methods. A `PASS` in these initial matrices means that the cited repository/specification evidence was found during this bounded audit; it is not a claim of complete conformance until executable coverage is added.

## Pinned standards baselines

Baselines were fetched on **2026-08-10**. The dated URLs and SHA-256 hashes below pin the fetched HTML snapshots for this audit:

| Baseline | Status/date | Dated URL | SHA-256 (fetched HTML) |
| --- | --- | --- | --- |
| DID Core 1.0 | W3C Recommendation, 2022-07-19 | [`REC-did-core-20220719`](https://www.w3.org/TR/2022/REC-did-core-20220719/) | `5e44345740d9bfaa852d3b66c57e98c9beb6c5bf6083b0126dd5daac377b9993` |
| DID Core 1.1 | W3C Candidate Recommendation Snapshot, 2026-03-05 | [`CR-did-1.1-20260305`](https://www.w3.org/TR/2026/CR-did-1.1-20260305/) | `4a48022defe07d37d2decc3ec9027a932dc883b2ad164a5aeaf9256e530bd979` |
| DID Resolution v1 | W3C Candidate Recommendation Snapshot, 2026-08-06 | [`CR-did-resolution-1.0-20260806`](https://www.w3.org/TR/2026/CR-did-resolution-1.0-20260806/) | `a4632a09600e0136022969114520dc3f8ee9af99ad80963e3ba1a368bea9af1a` |

DID Core 1.0 is the primary release gate. DID Core 1.1 remains a separate compatibility target. DID Resolution is recorded independently because its publication can evolve separately from DID Core.

## Tested repository snapshot

- Repository: `midnightntwrk/midnight-did`
- Commit inspected: `3a03100f47a2274834cec34e2b029c71d68753c1`
- Package version: `0.5.0` (`package.json`)
- Package manager: `pnpm@10.34.1`
- Node requirement: `>=24`
- Inspected product surfaces: `w3c-spec/midnight-method.md`, `packages/domain`, `packages/did`, `packages/api`, `packages/contract`, and their existing tests.

## Status vocabulary

- `PASS` — direct specification, implementation, and/or existing-test evidence supports the assertion.
- `PASS WITH RESTRICTION` — supported only within an explicit Midnight method boundary.
- `NOT APPLICABLE` — the assertion is not applicable to this method surface.
- `KNOWN INTEROPERABILITY LIMITATION` — a broader ecosystem limitation, not by itself a DID Core failure.
- `FAIL` — the inspected public behavior contradicts a normative requirement.
- `UNKNOWN` — the audit lacks enough executable evidence or a maintainer decision; a focused follow-up is required.

## Phase 1 follow-up queue

| Priority | Finding | Focused next work |
| --- | --- | --- |
| P0 | DID URL dereferencing is not exposed by the inspected resolver/API surfaces. | Maintainer decision: implement fragment/resource dereferencing, or explicitly scope it out; then add positive/negative dereferencing vectors or a separately tracked limitation issue. |
| P1 | JSON-LD coverage expands documents but does not yet prove compaction and semantic round-trip equivalence. | Add `expand → compact → compare` tests for all supported verification profiles and custom contexts. |
| P1 | Resolution negotiation tests cover common q-values but not malformed q-values, all precedence ties, or resolver failures. | Add focused representation negotiation/error vectors and verify metadata/body omission invariants. |
| P2 | Lifecycle behavior is tested in package-specific suites but not yet assembled into reproducible conformance vectors. | Add create/resolve/update/deactivate/rotation/recovery vectors with initial/final state and metadata. |
| P2 | Registry submission, public wording, external suite usefulness, and current BLS source remain maintainer decisions. | Record decisions before publication; do not add Multikey/new curves or VC/resolver-service behavior in this repository. |

The Phase 2 syntax slice is evidenced by `packages/domain/src/test/midnight-did-syntax.conformance.test.ts` and its fixtures. The queue is intentionally implementation-sized. It does not authorize redesigning the DID method or mixing VC/resolver-service work into this repository.

## Matrices

- [DID Core 1.0](./did-core-1.0.md)
- [DID Core 1.1 compatibility](./did-core-1.1.md)
- [DID Resolution](./did-resolution.md)

`test-results/` is reserved for generated evidence in later phases; this Phase 1 audit does not claim that a generated conformance command exists yet.
