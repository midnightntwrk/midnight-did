# Issue #501 post-release documentation retrospective

Date: 2026-09-18
Canonical tracker: [midnightntwrk/midnight-did#501](https://github.com/midnightntwrk/midnight-did/issues/501)

## What prompted the work

The final `0.6.0` package set and matching ZK artifacts were published, but the
repository's current-user documentation still presented RC1 as current and the
final release as future. The latest-release badge, changelog, and conformance
evidence also retained pre-publication wording, and consumers had no maintained
cross-release toolchain/runtime baseline.

## What worked

- The read-only release audit separated current consumer guidance from accurate
  historical RC and release-process examples, avoiding a broad replacement of
  valid historical evidence.
- Exact npm metadata, GitHub Release assets, and the GHCR OCI descriptor
  independently confirmed the coordinated `0.6.0` package and ZK coordinates.
- A machine-readable baseline plus a generated page kept immutable 0.5 evidence
  separate from current repository-derived 0.6 pins.
- Focused extraction and drift tests bind the current row to manifests,
  `.nvmrc`, workflow constants, and Compact pragmas, so future pin changes fail
  closed instead of silently leaving the matrix stale.
- The bounded exact-head follow-up made duplicated pin ownership explicit:
  Compact compiler workflows and every repeated runtime, ledger, Midnight JS,
  and wallet SDK manifest pin must agree before the matrix can be generated.

## Friction, failures, and configuration drift

- The npm website returned HTTP 403 to this environment even with a browser user
  agent. Read-only `npm view` checks against registry metadata verified all five
  exact versions instead; the public documentation URLs remain canonical.
- The first formatting attempt ran before workspace dependencies were installed.
  A frozen-lockfile install restored the pinned Prettier toolchain without
  changing manifests or the lockfile.
- Prettier expands wide Markdown tables into unreadably padded rows. The
  generated matrix uses a scoped `prettier-ignore` marker while all surrounding
  prose and generator code remain formatting-checked.
- The dev-loop startup resolver selected issue intake even though the request
  explicitly authorized local implementation in an already dedicated,
  main-based worktree. Work remained on that requested worktree and no issue
  assignment or duplicate PR was created.
- Adding the standard empty `## [Unreleased]` section exposed an overly narrow
  deterministic release-note parser that accepted only versioned level-two
  headings. The parser now recognizes exactly that standard boundary while
  preserving exact target-heading, duplicate-section, and non-empty-body
  validation.
- Code Quality identified the unused compatibility baseline path constant. It
  was removed, and the default repository-relative baseline loader remains
  covered directly.

## Validation and review evidence

The focused matrix, release-note extractor, and docs-validation tests cover
exact 0.6.0 body extraction with the standard Unreleased boundary, malformed
and duplicate target rejection, duplicated-pin disagreement, rendering,
baseline drift, final-release coordinates, navigation, and removal of future
wording. Docs validation checks generated-page freshness and local links. The
broader evidence includes VitePress build and visual checks, Prettier, package
audit, repository verification, exact-head CI, and one review-only current-head
regate. Commit signature/DCO and routed review evidence are verified
separately.

## Follow-ups

- Future release work must update
  `docs-site/data/compatibility-baselines.json` when repository-owned pins or the
  current release changes; the generator and drift tests enforce this locally.
- DID Core 1.1 and DID Resolution compatibility remains tracked by
  [#447](https://github.com/midnightntwrk/midnight-did/issues/447); this release
  documentation must not broaden the bounded DID Core 1.0 claim.
