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
  surfaces without introducing a matrix parser or policy engine.
- Reading the installed Midnight provider interfaces before documenting CMA and
  indexer posture separated controller/recovery custody from maintenance signing
  keys and separated trusted provider reads from independent verification.
- Listing exact file paths and test names made the evidence auditable while
  preserving all #434 read/write compatibility distinctions.

## Friction and decisions

- The full `pnpm run verify` gate reached an unrelated pre-existing timeout in
  `scripts/review/request-pr-reviews.test.mjs` while its fake PR-head read was
  starting; an isolated rerun reproduced the same one-second harness timeout.
  Product, conformance, domain, DID, docs, and package checks remained green.
- DID JSON semantic equivalence is tested against the abstract resolution result
  after removing the representation-specific JSON-LD context. JSON-LD
  equivalence is tested by comparing deterministic expansion before and after
  compaction. No general canonicalization framework was added.
- Invalid `Accept` quality values are ignored as non-selectable; supported values
  must be finite, greater than zero for selection, and no greater than one.
- Unsupported DID URL dereferencing and external suite integration remain
  explicit limitations rather than being converted into passing rows.

## Validation and review evidence

Focused conformance tests, full domain and DID suites, DID lint/typecheck, docs
sync/validate/build/visual, diff checks, commit integrity, hosted CI, and
exact-head routed review are recorded on the PR. The local aggregate verification
exception above remains visible rather than being represented as a clean gate.

## Follow-ups

- Release integration remains tracked by
  [#443](https://github.com/midnightntwrk/midnight-did/issues/443).
- DID URL dereferencing, external W3C suite integration, Multikey support, and
  independent indexer proof/light-client verification remain non-goals until a
  separate tracker defines their compatibility and ownership boundaries.
- The recurring review-dispatch harness timeout should be fixed in its owning
  tooling scope rather than widening this release evidence PR.
