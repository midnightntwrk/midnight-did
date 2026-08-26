# Issue #405 W3C evidence retrospective

Date: 2026-08-26
Canonical tracker: [midnightntwrk/midnight-did#405](https://github.com/midnightntwrk/midnight-did/issues/405)
Release tracker: [midnightntwrk/midnight-did#443](https://github.com/midnightntwrk/midnight-did/issues/443)
Breaking CR migration: [midnightntwrk/midnight-did#447](https://github.com/midnightntwrk/midnight-did/issues/447)

## What prompted the work

The conformance matrices still described a 0.5 source snapshot and several
behaviors as unknown after the 0.6 domain, resolver, lifecycle, and #434
compatibility work had made them executable. The release needed one small,
reproducible evidence lane without implying W3C certification or implementing
unsupported dereferencing and external-suite work.

Independent standards verification then found that the initial refresh treated
DID Core 1.0-era representation tests as positive evidence for the pinned 2026
Candidate Recommendations. That was inaccurate. DID Core 1.1 requires
`application/did` and `https://www.w3.org/ns/did/v1.1`; the Resolution CR uses
the unaltered `resolve(did, resolutionOptions)` contract, structured URL-typed
error objects, and a null DID Document for deactivated DIDs. Version 0.6 instead
uses old media types and context, split helpers, keyword errors, and readable
deactivated documents. The evidence needed correction without backporting a
coordinated breaking API migration into 0.6.

## What worked

- Starting from existing tests kept most matrix changes evidence-only and made
  the genuinely missing cases clear: semantic representation round trips,
  resolver-level deactivation metadata, equal-quality and invalid `Accept`
  values.
- One root `test:conformance` command could compose existing package build/test
  surfaces without introducing a matrix parser or policy engine, while a
  clean-tree guard prevents dirty tracked state from being recorded as exact
  revision evidence.
- Reading the installed Midnight provider interfaces before documenting CMA and
  indexer posture separated controller/recovery custody from maintenance signing
  keys and separated trusted provider reads from independent verification.
- Re-reading the exact dated W3C snapshots, rather than inferring the newer
  contract from DID Core 1.0 conventions, made the incompatibilities explicit
  and produced a bounded claim: 0.6 evidence supports DID Core 1.0; DID Core 1.1
  and the 2026 Resolution CR are audited compatibility targets with disclosed
  failures.
- Listing exact file paths and test names kept the evidence auditable while
  preserving all #434 read/write compatibility distinctions. Successors now
  separate the coordinated breaking migration (#447), dereferencing (#445), and
  external evidence/registry work (#446).

## Friction and decisions

- The original branch run of `pnpm run verify` stopped in the review-dispatch
  timeout fixture. A later inherited shell rerun passed that fixture, then
  stopped in the Jubjub Schnorr lane: `compact 0.5.1` was using
  `COMPACT_DIRECTORY` toolchain `0.30.0`, which generated code for Compact
  runtime `0.15.0` while the workspace dependency is `0.16.0`. A fresh
  `nix develop` resolved the repository-pinned `0.31.1` toolchain; the focused
  Schnorr lane and full `pnpm run verify` then passed without source or generated
  artifact changes. The mismatch was stale session-environment drift, not a
  reason to alter unrelated Compact/runtime code.
- DID JSON semantic equivalence is tested against the abstract resolution result
  after removing the representation-specific JSON-LD context. JSON-LD
  equivalence is tested by comparing deterministic expansion before and after
  compaction. Those remain useful tests of the 0.6 DID Core 1.0-era profile, but
  their `application/did+json` / `application/did+ld+json` and v1 context
  assertions are negative compatibility evidence for DID Core 1.1.
- Accept negotiation computes each offered representation's quality from its
  most specific matching range. Exact ranges override type/global wildcards,
  including exact `q=0` exclusions; RFC qvalue syntax and media/extension
  parameter placement are parsed without introducing a general HTTP library.
  The parser can be reused, but tests against the old offered media types and
  split `resolveRepresentation` helper do not establish 2026 Resolution CR
  compatibility.
- The Resolution CR's algorithm normatively returns structured error objects
  whose `type` is a W3C URL. Section 11 says RFC 9457 encoding is a SHOULD; that
  recommendation does not make keyword-string algorithm errors conforming.
- The 0.6 behavior remains documented rather than silently rewritten. Changing
  media types/context, the public resolver signature, error shapes, or the
  readable-deactivation contract would be breaking and is owned by #447.
- Unsupported DID URL dereferencing and external suite integration remain
  explicit limitations rather than being converted into passing rows.

## Validation and review evidence

Focused conformance tests, docs sync/validation/build/visual checks, the full
aggregate verification gate, formatting/diff checks, and all-commit
signature/DCO verification are rerun for the correction's exact clean head and
recorded on PR #444. Any evidence from the superseded head is not used as proof
for the corrected revision. Hosted CI and exact-head routed review remain
separate gates; the PR stays draft and human-only with no merge or auto-merge.

## Follow-ups

- Release integration remains tracked by
  [#443](https://github.com/midnightntwrk/midnight-did/issues/443).
- The coordinated breaking DID Core 1.1 / 2026 Resolution CR migration is
  tracked by [#447](https://github.com/midnightntwrk/midnight-did/issues/447)
  and is explicitly outside 0.6.
- DID URL dereferencing is tracked by
  [#445](https://github.com/midnightntwrk/midnight-did/issues/445).
- External W3C suite integration, immutable hosted/CI evidence, and registry
  posture are tracked by
  [#446](https://github.com/midnightntwrk/midnight-did/issues/446).
- When a Compact mismatch recurs, validation must start in a fresh repository
  `nix develop` environment before considering source or generated-artifact
  changes.
