# Midnight DID W3C Conformance Evidence

**Release lane:** focused 0.6 evidence refresh from the post-[#434](https://github.com/midnightntwrk/midnight-did/pull/434) baseline.
**Source of record:** [issue #405](https://github.com/midnightntwrk/midnight-did/issues/405), coordinated with the [0.6 release tracker #443](https://github.com/midnightntwrk/midnight-did/issues/443).

These matrices are implementation evidence, not formal W3C certification. W3C does not certify individual DID methods, and this repository does not claim full DID Core, DID Resolution, resolver-service, or ecosystem compatibility.

## Pinned standards baselines

| Baseline          | Status/date                                       | Dated URL                                                                                      | SHA-256 of audited HTML                                            |
| ----------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| DID Core 1.0      | W3C Recommendation, 2022-07-19                    | [`REC-did-core-20220719`](https://www.w3.org/TR/2022/REC-did-core-20220719/)                   | `5e44345740d9bfaa852d3b66c57e98c9beb6c5bf6083b0126dd5daac377b9993` |
| DID Core 1.1      | W3C Candidate Recommendation Snapshot, 2026-03-05 | [`CR-did-1.1-20260305`](https://www.w3.org/TR/2026/CR-did-1.1-20260305/)                       | `4a48022defe07d37d2decc3ec9027a932dc883b2ad164a5aeaf9256e530bd979` |
| DID Resolution v1 | W3C Candidate Recommendation Snapshot, 2026-08-06 | [`CR-did-resolution-1.0-20260806`](https://www.w3.org/TR/2026/CR-did-resolution-1.0-20260806/) | `a4632a09600e0136022969114520dc3f8ee9af99ad80963e3ba1a368bea9af1a` |

DID Core 1.0 is the primary evidence baseline. DID Core 1.1 and DID Resolution remain separately identified compatibility targets because both are Candidate Recommendation snapshots and can evolve independently.

## Tested repository baseline

- Repository: `midnightntwrk/midnight-did`
- 0.6 starting commit: `55dde88ce1e451587303b5f4fc388eef4bdb32f5`
- Package version: `0.6.0` (unreleased)
- Package manager: `pnpm@10.34.4`
- Node requirement: `>=24`
- Inspected surfaces: `w3c-spec/midnight-method.md`, `packages/domain`, `packages/did`, `packages/api`, `packages/contract`, and their tests.

## Reproduce the focused lane

From `nix develop`, after `pnpm install --frozen-lockfile`:

```bash
pnpm test:conformance
```

The command builds the existing contract prerequisite, then runs these exact files through existing package test surfaces:

- `packages/domain/src/test/midnight-did-syntax.conformance.test.ts`
- `packages/did/src/test/midnight-did-jsonld-conformance.test.ts`
- `packages/did/src/test/midnight-did-resolver.test.ts`

The matrices also cite exact tests in the full domain, DID, contract, and API suites where those tests are the direct evidence. Run the complete domain and DID suites with:

```bash
pnpm --filter ./packages/domain test:ci
pnpm --filter ./packages/did test:ci
```

No matrix parser, generated report, or policy engine is required for this lane; the Markdown matrices and executable test names are intentionally direct.

## Status vocabulary

- `PASS` — the cited executable test directly proves the stated behavior on the 0.6 baseline.
- `PASS WITH RESTRICTION` — the cited test proves behavior only inside the explicit Midnight method profile.
- `DOCUMENTED RESTRICTION` — the boundary is specified but is not itself an executable behavior claim.
- `KNOWN INTEROPERABILITY LIMITATION` — a deliberate ecosystem/profile limitation, not a DID Core failure by itself.
- `NOT IMPLEMENTED` — the capability is absent and is not represented as passing.
- `FAIL` — behavior contradicts the referenced requirement.

## Preserved 0.6 compatibility policy

The evidence retains all compatibility rules landed by #434:

- new verification-method, relationship, and service writes use complete canonical subject-bound DID URLs;
- exact current-subject `#fragment` physical keys remain readable and mutable through state-aware lookup, while canonical-plus-legacy ambiguity fails closed;
- historical root-path and dot-relative verification-method IDs without fragments remain read-compatible, but current mutation helpers do not update or remove those physical keys;
- historical foreign-DID service IDs remain read-compatible, while new foreign-DID service writes are rejected;
- network-path verification-method IDs resolve as structured `invalidDid` errors;
- service endpoint arrays are non-empty and unique after normalization; and
- API-created handles use state-aware lookup in the deprecated four-argument Schnorr verifier, while unregistered third-party handles retain only the documented legacy fragment fallback.

## Explicit residual limitations

- DID URL dereferencing (fragment/resource/path/query dereferencing) is not exposed by `packages/did` or `packages/api`. Bare-DID resolution and DID URL reference normalization do not substitute for dereferencing.
- No external W3C DID/DID Resolution test suite is integrated. `pnpm test:conformance` is repository-owned evidence only.
- `publicKeyMultibase`/`Multikey` is not a current ledger profile. Jubjub is Midnight-private, and the BLS JWK curve names remain a constrained profile.
- The reference resolution path trusts the configured indexer/provider. It supplies no light client, independent state proof, or independent finality verification.
- This lane does not provide a generic in-place contract migration or upgrade system.

## Matrices

- [DID Core 1.0](./did-core-1.0.md)
- [DID Core 1.1 compatibility](./did-core-1.1.md)
- [DID Resolution](./did-resolution.md)
