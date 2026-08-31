# PR #455: CodeQL upload-sarif update retrospective

Date: 2026-08-31
Canonical tracker: [midnightntwrk/midnight-did PR #455](https://github.com/midnightntwrk/midnight-did/pull/455)

## What prompted the work

Dependabot proposed updating the immutable `github/codeql-action/upload-sarif`
pin from 4.37.6 to 4.37.8 in the Scorecard workflow. The branch was clean but
behind the completed 0.6 `develop` merge train.

## What worked

- The one-line workflow delta retained an immutable commit SHA and an accurate
  version comment.
- Independent review confirmed that the pinned commit is the verified peeled
  commit for the official 4.37.8 tag.
- Current `develop` merged cleanly into the dependency branch without changing
  the workflow delta.
- Repository policy and strict local gates remained green.

## Friction and failures

- The original exact-head checks did not establish readiness against the latest
  `develop` tip because GitHub classified the branch as behind.
- PR #451 proposed an older 4.37.7 pin in the same workflow. PR #455 must land
  first, and #451 must subsequently drop that superseded workflow hunk.

## Decisions

- Keep the change limited to the official immutable CodeQL action update and
  this audit record.
- Refresh the branch with a signed, DCO-compliant merge commit rather than
  rewriting the bot commit.
- Exclude the held Midnight runtime and proving-stack update in PR #452.

## Tracked follow-up actions

- PR #455 tracks exact-head CI, routed peer review, and human merge approval.
- Refresh PR #451 after #455 lands and retain only its still-unique package
  updates.

## Guardrails

This work does not change workflow permissions, runtime dependencies, DID or
Compact behavior, release scope, or the repository's human-only merge rule.
