# Issue #496 PR #490 release-safety revert retrospective

Date: 2026-09-17
Canonical tracker: [midnightntwrk/midnight-did#496](https://github.com/midnightntwrk/midnight-did/issues/496)
Reverted merge: `af8184734e0735dbeb4491caedb5353efdedcb63` (PR #490)

## What worked

The exact-head draft gate stopped unsafe release changes before promotion to
`main`. Keeping the remediation to a mainline revert makes the restored product
and release tree mechanically comparable with the first parent of PR #490 while
preserving the preceding #487, #488, #489, and #492 merges.

## What failed

PR #490 merged to `develop` despite unresolved release-path findings. Its flow
could create a public GitHub Release before semantic provenance verification,
mis-handle a final release when `rc_index` was omitted, and reuse a release
without first binding the tag target. Those defects make partial repair too
risky for the 0.6 RC2 train.

## Configuration drift and process gaps

No toolchain or policy configuration change is needed for this revert. The
process gap was allowing a merge after a material exact-head gate verdict;
release-facing findings must remain blocking through merge authorization, not
only through review.

## Structured self-review

| Lens           | Result | Evidence                                                                         |
| -------------- | ------ | -------------------------------------------------------------------------------- |
| Scope          | Clean  | The #490 path set matches its first parent; only this retrospective is additive. |
| Correctness    | Clean  | The staged patch is byte-for-byte the reverse merge diff with mainline 1.        |
| Release safety | Clean  | No publication, tag, registry, or workflow-dispatch action was performed.        |
| Preservation   | Clean  | The #487, #488, #489, and #492 commits remain ancestors of the branch.           |

## Follow-up actions

- Issues #494 and #495 own any redesigned release-note and release-verification
  work for the 0.7 milestone; this revert retains none of PR #490's features.
- Issue #496 and its draft PR track exact-head CI, signed/DCO commit checks,
  routed review, and human approval before the RC2 promotion can proceed.
- Release publication, tagging, registry mutation, and workflow dispatch remain
  explicitly outside this revert.
