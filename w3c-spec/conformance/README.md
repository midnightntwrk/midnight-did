# Midnight DID W3C Conformance Evidence

**Release lane:** focused 0.6 evidence refresh from the post-[#434](https://github.com/midnightntwrk/midnight-did/pull/434) baseline.
**Source of record:** [issue #405](https://github.com/midnightntwrk/midnight-did/issues/405), coordinated with the [0.6 release tracker #443](https://github.com/midnightntwrk/midnight-did/issues/443).

The 0.6 conformance claim is bounded to the DID Core 1.0 Recommendation. The DID Core 1.1 and 2026 DID Resolution Candidate Recommendation snapshots are audited forward-compatibility targets with disclosed failures; they are not 0.6 passing claims. The coordinated breaking representation and resolution migration is tracked by [#447](https://github.com/midnightntwrk/midnight-did/issues/447).

These matrices are implementation evidence, not formal W3C certification. W3C does not certify individual DID methods, and this repository does not claim full DID Core 1.1, DID Resolution, resolver-service, or ecosystem compatibility.

## Pinned standards baselines

| Baseline          | Status/date                                       | Dated URL                                                                                      | SHA-256 of audited HTML                                            |
| ----------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| DID Core 1.0      | W3C Recommendation, 2022-07-19                    | [`REC-did-core-20220719`](https://www.w3.org/TR/2022/REC-did-core-20220719/)                   | `5e44345740d9bfaa852d3b66c57e98c9beb6c5bf6083b0126dd5daac377b9993` |
| DID Core 1.1      | W3C Candidate Recommendation Snapshot, 2026-03-05 | [`CR-did-1.1-20260305`](https://www.w3.org/TR/2026/CR-did-1.1-20260305/)                       | `4a48022defe07d37d2decc3ec9027a932dc883b2ad164a5aeaf9256e530bd979` |
| DID Resolution v1 | W3C Candidate Recommendation Snapshot, 2026-08-06 | [`CR-did-resolution-1.0-20260806`](https://www.w3.org/TR/2026/CR-did-resolution-1.0-20260806/) | `a4632a09600e0136022969114520dc3f8ee9af99ad80963e3ba1a368bea9af1a` |

DID Core 1.0 is the normative conformance baseline for 0.6. DID Core 1.1 and DID Resolution remain separately identified audited compatibility targets because both are Candidate Recommendation snapshots and can evolve independently. Their matrices intentionally show the incompatible 0.6 context, media types, resolver signature, split helpers, keyword errors, and deactivation result as failures or absent capabilities rather than converting DID Core 1.0 tests into positive CR evidence. [#447](https://github.com/midnightntwrk/midnight-did/issues/447) owns the coordinated breaking migration after 0.6.

## Integration base and implementation under test

- Repository: `midnightntwrk/midnight-did`
- 0.6 integration base: `55dde88ce1e451587303b5f4fc388eef4bdb32f5`
- Runtime implementation under test: the exact clean `git rev-parse HEAD` printed by `pnpm test:conformance`; it is intentionally not hardcoded in this document or script.
- Package version: `0.6.0` (unreleased)
- Package manager pin: `pnpm@10.34.4`
- Node requirement: `>=24`
- Inspected surfaces: `w3c-spec/midnight-method.md`, `packages/domain`, `packages/did`, `packages/api`, `packages/contract`, and their tests.

The integration base identifies where this release-phase work began; it is not the revision tested at runtime. Exact revision evidence comes from clean-tree command output and is recorded in PR or release evidence. The command records an initially clean tracked HEAD, runs the complete lane, and then fails if HEAD changed or tracked staged/unstaged files became dirty (untracked files are ignored). This repository does not currently run this focused lane in CI or retain its output; external-suite integration, immutable hosted/CI evidence, and registry posture remain tracked by [#446](https://github.com/midnightntwrk/midnight-did/issues/446). A mutable Markdown branch view alone is not exact release evidence.

## Reproduce the focused lane

From `nix develop`, after `pnpm install --frozen-lockfile`:

```bash
pnpm test:conformance
```

The command first refuses a tracked-dirty worktree, then prints a compact evidence banner containing the exact clean Git HEAD, root package version, contract package version, actual Node and pnpm versions, and the three pinned standards URLs/digests. After the package commands finish, it verifies that HEAD is unchanged and the tracked tree remains clean before reporting successful evidence. Pinning and running tests against a target does not imply a passing result. In particular, the representation tests below prove the 0.6 DID Core 1.0-era profile and expose its 1.1/Resolution incompatibilities; they are not positive 1.1 representation evidence. The command builds the existing contract prerequisite and runs these exact files through existing package test surfaces:

- `packages/domain/src/test/midnight-did-syntax.conformance.test.ts`
- `packages/did/src/test/midnight-did-jsonld-conformance.test.ts`
- `packages/did/src/test/midnight-did-resolver.test.ts`

The matrices also cite exact tests in the full domain, DID, contract, and API suites where those tests are the direct evidence. Run the complete domain and DID suites with:

```bash
pnpm --filter ./packages/domain test:ci
pnpm --filter ./packages/did test:ci
```

No matrix parser, generated report, or general conformance policy engine is required for this lane; the Markdown matrices, runtime banner, and executable test names are intentionally direct.

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

- Version 0.6 does not satisfy the pinned DID Core 1.1 and DID Resolution CR representation/resolution contracts. It uses `https://www.w3.org/ns/did/v1`, `application/did+json`/`application/did+ld+json`, split resolution helpers, keyword-string errors, and a readable document after deactivation. The coordinated breaking migration to `https://www.w3.org/ns/did/v1.1`, `application/did`, the standard resolver signature, structured URL-typed errors, and aligned deactivation results is tracked by [#447](https://github.com/midnightntwrk/midnight-did/issues/447).
- DID URL dereferencing (fragment/resource/path/query dereferencing) is not exposed by `packages/did` or `packages/api`. Bare-DID resolution and DID URL reference normalization do not substitute for dereferencing; implementation is tracked by [#445](https://github.com/midnightntwrk/midnight-did/issues/445).
- No external W3C DID/DID Resolution test suite or immutable hosted evidence is integrated. `pnpm test:conformance` is repository-owned evidence only; external-suite/CI evidence and registry posture are tracked by [#446](https://github.com/midnightntwrk/midnight-did/issues/446).
- `publicKeyMultibase`/`Multikey` is not a current ledger profile. Jubjub is Midnight-private, and the BLS JWK curve names remain a constrained profile.
- The reference resolution path trusts the configured indexer/provider. It supplies no light client, independent state proof, or independent finality verification.
- This lane does not provide a generic in-place contract migration or upgrade system.

## Matrices

- [DID Core 1.0 — 0.6 conformance baseline](./did-core-1.0.md)
- [DID Core 1.1 — audited compatibility target, overall FAIL](./did-core-1.1.md)
- [DID Resolution — audited 2026 CR target, overall FAIL](./did-resolution.md)
