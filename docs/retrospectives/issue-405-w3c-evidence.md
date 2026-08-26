# Issue #405 W3C evidence retrospective

Date: 2026-08-26
Canonical tracker: [midnightntwrk/midnight-did#405](https://github.com/midnightntwrk/midnight-did/issues/405)
Release tracker: [midnightntwrk/midnight-did#443](https://github.com/midnightntwrk/midnight-did/issues/443)

## What prompted the work

The conformance matrices still described a 0.5 source snapshot and several
behaviors as unknown after the 0.6 domain, resolver, lifecycle, and #434
compatibility work had made them executable. The release needed one small,
reproducible evidence lane without implying W3C certification or implementing
unsupported dereferencing and external-suite work.

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
- Listing exact file paths and test names made the evidence auditable while
  preserving all #434 read/write compatibility distinctions.

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
  compaction. No general canonicalization framework was added.
- Accept negotiation computes each offered representation's quality from its
  most specific matching range. Exact ranges override type/global wildcards,
  including exact `q=0` exclusions; RFC qvalue syntax and media/extension
  parameter placement are parsed without introducing a general HTTP library.
- Unsupported DID URL dereferencing and external suite integration remain
  explicit limitations rather than being converted into passing rows.

## Validation and review evidence

Focused conformance tests, full domain and DID suites, DID lint/typecheck, docs
sync/validate/build/visual, diff checks, and commit integrity are recorded on the
PR. The full aggregate verification passed in a fresh `nix develop` environment.
Hosted CI and exact-head routed review remain pending.

## Follow-ups

- Release integration remains tracked by
  [#443](https://github.com/midnightntwrk/midnight-did/issues/443).
- DID URL dereferencing is tracked by
  [#445](https://github.com/midnightntwrk/midnight-did/issues/445).
- External W3C suite integration, immutable hosted/CI evidence, and registry
  posture are tracked by
  [#446](https://github.com/midnightntwrk/midnight-did/issues/446).
- When a Compact mismatch recurs, validation must start in a fresh repository
  `nix develop` environment before considering source or generated-artifact
  changes.
