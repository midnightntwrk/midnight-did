# Issue #507 minimized 0.7 branch-reconciliation retrospective

Date: 2026-09-21
Canonical tracker: [midnightntwrk/midnight-did#507](https://github.com/midnightntwrk/midnight-did/issues/507)

## Checkpoint

- Frozen `main`: `80a5d53a14dfba5b5969483db1fa0518dbee1c48` after PR #502.
- Frozen `develop`: `05b8fba3b5fa5ca7b2357741af062ffe6ef3790a` after PR #504.
- Main-to-develop draft: [PR #508](https://github.com/midnightntwrk/midnight-did/pull/508).
- Develop-to-main staging draft: [PR #509](https://github.com/midnightntwrk/midnight-did/pull/509).
- No merge, publication dispatch, tag, release, registry mutation, or auto-merge is authorized by these drafts.

## What worked

- The synchronization treated current branch trees as authority instead of
  merging 30/51 commits of divergent legacy ancestry.
- Starting from frozen `develop`, the PR #502 delta was applied path-by-path.
  Only `CHANGELOG.md` and the VitePress sidebar overlapped with PR #504, so they
  received explicit union resolutions rather than accepting either side
  wholesale.
- The combined changelog retains the planned 0.7 Jubjub migration while
  preserving the immutable published 0.6.0 body at SHA-256
  `0f8196a4aa7fb324ad6b578764f91e780e69b69c0c320c82471185e33133740e`.
- The combined navigation exposes both the post-release compatibility matrix and
  the 0.7 migration/ADR material.
- The main-based staging branch used `git read-tree --reset -u` from the signed
  combined commit and then restored only the two documented main-only historical
  retrospective records.

## Tree-equivalence contracts

PR #508 starts from frozen `develop`; its content delta is the reviewed PR #502
change plus the two explicit overlapping-file resolutions.

PR #509 must differ from PR #508's combined tree only by:

1. `docs/retrospectives/issue-498-develop-main-rc2-sync.md`; and
2. `docs/retrospectives/pr-459-develop-main-promotion.md`.

This issue #507 retrospective is intentionally present in both branches after
their final documentation commits. No source, workflow, package, lockfile,
generated artifact, or current-user documentation difference is an allowed
promotion exception.

## Scope decisions

- The 0.7 release is limited to the standards-aligned Jubjub JWK coordinate
  migration, post-0.6 documentation, and bounded release-safety work in #507.
- Invalid/identity point hardening (#505), response-scalar canonicality (#506),
  and challenge-reduction ambiguity (#241) are explicitly assigned to the new
  Midnight DID 0.8.0 milestone. The deferral is documented, not treated as a
  resolution.
- Resolver issue `midnight-did-resolver#123` and VC issue
  `midnight-verifiable-credentials#660` consume published 0.7 artifacts and do
  not block package publication. Production producer activation still waits for
  compatible consumers.
- PR #509 is a staging draft, not the final frozen release candidate. It must be
  refreshed after PR #508 and the remaining #507 release gates land on
  `develop`.

## Friction and failures

- The first aggregate `pnpm run verify` attempt ran while several focused jobs
  had recently loaded the host and hit the review-dispatch suite's one-second
  subprocess timeout while reading a mocked PR head. The exact focused suite
  immediately passed all 32 tests, and a subsequent clean exact-head aggregate
  rerun completed successfully.
- New worktrees do not share dependency or project-local Pi installations. The
  reconciliation worktree used a frozen install; the promotion tree relies on
  deterministic tree equivalence until its final exact-head validation.
- The published 0.6 section on `develop` had drifted from the immutable release
  body. Synchronization selected the hash-pinned `main` body while keeping the
  new 0.7 content under `Unreleased`.

## Validation evidence

The combined tree passed frozen installation, docs/compatibility tests, docs
validation/build/visual checks, release-context tests, a 1,000-case-per-property
domain fuzz run, repository policy, the focused review-dispatch rerun, and a
subsequent clean exact-head `pnpm run verify`. Hosted CI remains a draft gate.

## Next actions

1. Complete exact-head validation, draft-gate review, retrospective checkpoints,
   routed review, and human merge for PR #508.
2. Land the bounded release-safety and final 0.7 preparation work from #507 on
   the reconciled `develop` branch.
3. Refresh PR #509 to exact frozen-tree equivalence, rerun every gate, and merge
   it manually only after human approval.
4. Dispatch publication separately from the approved `main` SHA; never publish
   as a side effect of either synchronization PR.
