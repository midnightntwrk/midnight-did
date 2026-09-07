# Midnight DID W3C Conformance Evidence

**Evidence lane:** focused repository and CI conformance evidence for the 0.6 implementation baseline.
**Source of record:** [issue #405](https://github.com/midnightntwrk/midnight-did/issues/405); external-harness work is tracked by [#446](https://github.com/midnightntwrk/midnight-did/issues/446).

The 0.6 conformance claim is bounded to the DID Core 1.0 Recommendation. The DID Core 1.1 and 2026 DID Resolution Candidate Recommendation snapshots are audited forward-compatibility targets with disclosed failures; they are not 0.6 passing claims. The coordinated breaking representation and resolution migration is tracked by [#447](https://github.com/midnightntwrk/midnight-did/issues/447).

These matrices are implementation evidence, not formal W3C certification. W3C does not certify individual DID methods, and this repository does not claim full DID Core 1.1, DID Resolution, resolver-service, or ecosystem compatibility.

<!-- BEGIN EXTERNAL SUITE BASELINE -->

## External DID Core suite evidence

The machine-readable source of truth is [`external-suites.json`](./external-suites.json). This section is rendered from that baseline; edit the JSON and rerun `pnpm conformance:external:docs` rather than editing this block.

| Standard          | 0.6 status | Immutable baseline                                                           | SHA-256                                                            |
| ----------------- | ---------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| DID Core 1.0      | PASS       | [dated snapshot](https://www.w3.org/TR/2022/REC-did-core-20220719/)          | `5e44345740d9bfaa852d3b66c57e98c9beb6c5bf6083b0126dd5daac377b9993` |
| DID Core 1.1      | FAIL       | [dated snapshot](https://www.w3.org/TR/2026/CR-did-1.1-20260305/)            | `4a48022defe07d37d2decc3ec9027a932dc883b2ad164a5aeaf9256e530bd979` |
| DID Resolution v1 | FAIL       | [dated snapshot](https://www.w3.org/TR/2026/CR-did-resolution-1.0-20260806/) | `a4632a09600e0136022969114520dc3f8ee9af99ad80963e3ba1a368bea9af1a` |

The supplementary harness is [`w3c/did-test-suite`](https://github.com/w3c/did-test-suite) at commit `939b31d07d5b1699340ac0702ec0fa46ffcdef0a` (archive SHA-256 `c4e464d3f49d265a4023f646a77db7abc0992ff844d3055c180cd1c1c86717bd`; complete extracted-tree SHA-256 `bacdbd9ed79bbe772383f99b8df39c037bc6ee8a49622ca33de77c73be55526c`). It runs only these suites, with pinned expected assertion counts: `did-identifier` (1), `did-core-properties` (60), `did-production` (47), `did-consumption` (46). They execute against a deterministic descriptor generated through the built public `@midnight-ntwrk/midnight-did` exports. `did-consumption` is labelled representation consumability because generation first round-trips the JSON-LD representation through `parseMidnightDIDDocument`; it is not broader semantic conformance.

Excluded scope: did-resolution (legacy keyword-error and split-helper contract); did-url-dereferencing (not exposed by the package); synthetic DID Core 1.1 context rewriting; CBOR representations; HTTP binding and public endpoints; unrelated upstream implementations.

Upstream licensing is **mixed-or-unclear**: root metadata says Apache-2.0, `LICENSE.md` applies the W3C Document License, and child package metadata is missing-or-empty. [Maintainer approval is recorded](https://github.com/midnightntwrk/midnight-did/issues/446#issuecomment-5569537724) for executing the unmodified checksum-verified snapshot and publishing exact-commit derived test results with this caveat. The CI-only harness creates a new unpredictable mode-0700 temporary root for every acquisition and execution, verifies the exact archive, complete source tree, all three lockfiles, license metadata, and explicit runtime-source digests, and installs only the two required child lockfiles with lifecycle scripts disabled. Trusted repository code generates the fixture first; only that fixture, the adapter/setup files, the selected suite allowlist, implementation data, matcher source, and lockfile-installed dependencies enter the isolated runtime. Before external code starts, that runtime is read-only. External code receives no repository-wide read, CI credentials, supplementary groups, privilege gain, or network and can write only a temporary raw-results directory. The trusted parent validates and normalizes those raw bytes before atomically publishing only canonical `w3c-conformance-evidence.json` and its `.sha256` checksum in the fixed `test-results/w3c-conformance` tree. The exact Node 24 patch used by the run is recorded in the canonical evidence. The complete download/install/runtime tree is made removable and deleted in `finally`; no cache or marker persists. The lane is Linux-only and uses trusted `unshare`/`setpriv`, restoring the original non-root UID/GID, clearing groups, and setting no-new-privileges with an in-namespace guard; unsupported platforms or isolation fail closed. The approval variable remains fail closed. It does not permit vendoring or modifying upstream source, registry submission, or package, tag, release, signing, or provenance integration.

Registry posture: **`decision-pending-ownership-confirmation`**. The decision whether to update the [existing IAMX-linked entry](https://github.com/w3c/did-extensions/blob/de7836c8c4b51fde9500f5fa093e17f5229ec99d/methods/midnight.json) or record no update remains open until maintainers confirm ownership/contact continuity. Do not create a duplicate registration. Suite evidence is not registration, certification, W3C endorsement, or immutable release evidence.

<!-- END EXTERNAL SUITE BASELINE -->

DID Core 1.0 is the normative conformance baseline for 0.6. DID Core 1.1 and DID Resolution remain separately identified audited compatibility targets because both are Candidate Recommendation snapshots and can evolve independently. Their matrices intentionally show the incompatible 0.6 context, media types, resolver signature, split helpers, keyword errors, and deactivation result as failures or absent capabilities rather than converting DID Core 1.0 tests into positive CR evidence. [#447](https://github.com/midnightntwrk/midnight-did/issues/447) owns the coordinated breaking migration after 0.6.

## Integration base and implementation under test

- Repository: `midnightntwrk/midnight-did`
- 0.6 integration base: `55dde88ce1e451587303b5f4fc388eef4bdb32f5`
- Runtime implementation under test: the exact clean `git rev-parse HEAD` printed by `pnpm test:conformance`; it is intentionally not hardcoded in this document or script.
- Package version: `0.6.0` (unreleased)
- Package manager pin: `pnpm@10.34.5` (authoritative `package.json#packageManager`)
- External-lane Node policy/npm pin: major `24` (the exact runtime patch is recorded in evidence) / `11.16.0`
- Inspected surfaces: `w3c-spec/midnight-method.md`, `packages/domain`, `packages/did`, `packages/api`, `packages/contract`, and their tests.

The integration base identifies where the analysis began; it is not the revision tested at runtime. Both repository and external evidence commands record an initially clean tracked HEAD and fail if HEAD or tracked files change. The dedicated `W3C conformance` CI job runs the repository-owned lane independently, then runs the external lane only with the approval variable and uploads only canonical `w3c-conformance-evidence.json` and its checksum from the fixed `test-results/w3c-conformance/` tree under the exact checked-out SHA. Missing approval, isolation, acquisition, validation, or output fails visibly. Workflow artifacts are retention-bound CI evidence; immutable release evidence, signing, and provenance integration remain open and are deliberately not implemented by this slice.

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

The repository-owned lane remains authoritative and mandatory. The external command is CI-only. In an isolated CI-equivalent validation runner, use:

```bash
CI=true W3C_SUITE_DERIVED_ARTIFACTS_APPROVED=true pnpm test:conformance:external
```

On a Linux CI runner, the command generates the fixture with trusted built package code, then creates a fresh unpredictable mode-0700 temporary root, downloads, verifies, installs, and executes the exact pinned upstream snapshot. All lifecycle scripts are disabled. Only allowlisted external source/data and trusted fixture/adapter/setup files are copied into the isolated read-only runtime. External execution is non-root with supplementary groups cleared and no-new-privileges set, has no network, secrets, or repository-wide read access, and can write only temporary raw results. The trusted parent validates those bytes and atomically emits only canonical JSON, including normalized per-suite results and hashes, plus its checksum to the fixed `test-results/w3c-conformance/` path. The complete temporary root is removed in `finally`; no cache or acquisition marker survives. It requires trusted `unshare` and `setpriv` and an original non-root runner identity; unsupported platforms or unavailable isolation fail closed.

The command requires Node major 24, exact npm 11.16.0, `pnpm@10.34.5`, Compact 0.31.1, a clean exact HEAD, and explicit approval; it records the exact Node patch actually used in canonical evidence. Failed, missing, pending, skipped, todo, empty, malformed, or drifting results fail. `pnpm conformance:external:acquire` is only a CI diagnostic of the same fresh acquisition path and also removes its runtime before returning; it does not prepare reusable state.

Immutable release publication evidence is still open. This CI-only slice does not modify release workflows, sign conformance outputs, add them to provenance, publish a release asset, or claim that a retention-bound workflow artifact is immutable release evidence.

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
- The external lane is supplemental static-fixture DID Core 1.0 evidence only. It does not exercise deployed ledger/indexer behavior, finality, availability, HTTP resolution, DID Resolution CR, dereferencing, DID Core 1.1, certification, or endorsement. Repository-owned tests remain authoritative.
- `publicKeyMultibase`/`Multikey` is not a current ledger profile. Jubjub is Midnight-private, and the BLS JWK curve names remain a constrained profile.
- The reference resolution path trusts the configured indexer/provider. It supplies no light client, independent state proof, or independent finality verification.
- This lane does not provide a generic in-place contract migration or upgrade system.

## Matrices

- [DID Core 1.0 — 0.6 conformance baseline](./did-core-1.0.md)
- [DID Core 1.1 — audited compatibility target, overall FAIL](./did-core-1.1.md)
- [DID Resolution — audited 2026 CR target, overall FAIL](./did-resolution.md)
- [Registry posture — existing registration update deferred pending human confirmation](./registry.md)
