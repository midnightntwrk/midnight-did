# Issue #485 bounded conformance claim retrospective

Date: 2026-09-17
Canonical tracker: [midnightntwrk/midnight-did#485](https://github.com/midnightntwrk/midnight-did/issues/485)
Breaking standards migration: [midnightntwrk/midnight-did#447](https://github.com/midnightntwrk/midnight-did/issues/447)

## What prompted the work

The 0.6 method abstract broadly said that the specification conformed to a
`[W3C-DID]` publication attributed to the W3C Credentials Community Group. That
wording misstated the publisher of the DID Core 1.0 Recommendation and exceeded
the repository's bounded conformance matrices and supplemental external fixture
evidence.

## What worked

- The existing dated standards snapshots, evidence matrices, and explicit 0.6
  resolution limitations supplied one consistent boundary: DID Core 1.0 is the
  target profile, while DID Core 1.1 and the 2026 DID Resolution CR are failing
  compatibility targets.
- Keeping the canonical change in `w3c-spec/midnight-method.md` and running the
  existing sync generator preserved the source/generated ownership boundary.
- Focused docs validation now rejects both the old CCG attribution and the
  unqualified conformance sentence, while requiring the bounded evidence,
  non-certification statement, limitation links, and #447 migration link.
- The generated-page regression proves that the existing generator carries the
  corrected claim and rewrites matrix links into usable docs-site links.

## Friction, failures, and configuration drift

- The external W3C lane intentionally cannot be executed locally: acquisition
  and execution are CI-only, approval-gated, Linux-only, and network-isolated.
  Its contract suite is the applicable local no-network check.
- The canonical specification predates repository-wide Prettier formatting and
  does not pass a whole-file Prettier check even on the parent commit. Formatting
  therefore covers the changed JavaScript, while Markdown changes remain narrow
  and pass `git diff --check` plus docs validation/build/visual checks.
- Generated `docs-site/spec/*.md` pages are ignored build output. They were
  inspected and tested after generation but were not hand-edited or committed.
- After #488 merged, this stacked branch was rebuilt by replaying only the #485
  commit onto current `origin/develop`. The replay required no textual conflict
  resolution: the merged #488 adoption checks and this change's bounded-claim
  checks coexist in `scripts/docs-validate.test.mjs`. `git range-diff` reported
  the original and rewritten #485 patches as equivalent; prior #482, #487, and
  #488 stack commits are absent from the final PR range.
- The exact-head draft gate found that the initial guard was too literal: a
  rephrased affirmative claim, changed dated URL, or positive Resolution claim
  could evade it. The follow-up tightened the complete dated links and coupled
  exclusions, added a rephrased negative fixture, and checks those contracts in
  generated output.

## Validation and review evidence

The focused regression, external fixture contract tests, generated-doc sync and
validation, VitePress build and visual checks, dependency audit, conformance
lane, and mandatory repository verification gate cover this docs-only change.
Exact-head signature/DCO verification, routed review, feedback audit, and hosted
CI are recorded on the draft pull request rather than inferred from local tests.

## Follow-ups

- [#447](https://github.com/midnightntwrk/midnight-did/issues/447) remains the
  owner of DID Core 1.1 and 2026 DID Resolution CR migration; this claim-only
  correction must not implement that breaking work.
- [#445](https://github.com/midnightntwrk/midnight-did/issues/445) remains the
  owner of DID URL dereferencing, and
  [#446](https://github.com/midnightntwrk/midnight-did/issues/446) remains the
  owner of external evidence and registry/ownership decisions.
- Future conformance wording changes should extend the focused validator rather
  than relying on prose review to preserve the profile boundary.
