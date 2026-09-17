# PR #460: unused shell parser binding retrospective

Date: 2026-09-01
Canonical tracker: [midnightntwrk/midnight-did PR #460](https://github.com/midnightntwrk/midnight-did/pull/460)

## What prompted the work

GitHub Code Quality found an unused `args` destructuring binding while reviewing
the draft develop-to-main promotion PR #459. The finding exists in the current
`develop` tree, so it is fixed on `develop` rather than creating main-only drift.

## What worked

- The finding was concrete, behavior-preserving, and limited to one test line.
- The focused repository-policy test and mandatory `pnpm run verify` gate passed
  in a dedicated worktree.
- The normal command branch continues to parse and inspect arguments; only the
  redirected-statement branch's unused local binding is removed.

## Friction and failures

- A pre-existing low-severity static-quality issue surfaced only when the large
  promotion diff was reviewed. Existing CI lint did not report it on `develop`.
- Repository policy requires a separate protected-branch PR and human merge even
  for this one-line fix, so it becomes an explicit predecessor of the final
  promotion refresh.

## Decisions

- Fix the issue on `develop` first and refresh PR #459 only after this PR and the
  safe pnpm update in PR #451 are human-merged.
- Do not resolve the promotion review thread as fixed until the final promotion
  head actually contains this commit through the frozen `develop` tree.
- Keep the change limited to the unused binding; do not refactor shell-policy
  parsing during release promotion.

## Tracked follow-up actions

- PR #460 tracks exact-head CI, routed review, and the mandatory human merge.
- PR #459 tracks the subsequent final `develop` snapshot and confirmation that
  the Code Quality thread is resolved on the updated head.

## Guardrails

This PR does not alter shell-policy behavior, production code, dependencies,
public APIs, DID semantics, branch protection, release state, or merge authority.
