# Issue #498: develop-to-main RC2 reconciliation retrospective

Date: 2026-09-17
Canonical tracker: [midnightntwrk/midnight-did issue #498](https://github.com/midnightntwrk/midnight-did/issues/498)

## Checkpoint

- Frozen source: `origin/develop` at `af8184734e0735dbeb4491caedb5353efdedcb63`
- Frozen target: `origin/main` at `438c3d331a4a87b2f4d52f01aa27d598194a080f`
- Reconciliation branch: `codex/issue-498-develop-main-rc2-sync`
- Intended target branch: `main`
- Release candidate: `0.6.0-rc2`

## What worked

- Both remote tips were fetched and checked against the issue's frozen SHAs before the worktree changed.
- The reconciliation began at the exact `origin/main` target and used `git read-tree --reset -u origin/develop` to carry the complete frozen develop tree as content rather than selecting files by hand.
- The result retains develop's manual-only npm Trusted Publishing flow, compile-generator-pinned SLSA path, bounded same-RC convergence recovery, current conformance/docs/release controls, and the merged #487-#490 content without importing divergent history.
- Superseded main-only npm token-authority workflow and test files are absent because the complete develop tree replaced them.

## Tree-equivalence checkpoint

The committed tree must differ from frozen `origin/develop` only at these paths:

1. `docs/retrospectives/pr-459-develop-main-promotion.md` — preserved historical main-only promotion record.
2. `docs/retrospectives/issue-498-develop-main-rc2-sync.md` — this reconciliation's current checkpoint and retrospective.

The deterministic check is:

```bash
git diff --name-status af8184734e0735dbeb4491caedb5353efdedcb63 HEAD
```

No implementation, workflow, test, generated artifact, package, lockfile, or current documentation file is an allowed exception.

## What failed or caused friction

- `main` and `develop` still have divergent legacy ancestry from earlier squash-style promotions and back-syncs. A normal history merge would reintroduce historical conflicts and commits that do not satisfy today's signature/DCO policy.
- The tree-level reconciliation necessarily presents the whole current develop delta against main, so review and CI must verify source-tree equivalence rather than infer correctness from ancestry.
- The generic dev-loops doctor reports optional subagent setup as missing in this harness; the repository-specific diagnostic independently confirmed the dedicated worktree, pinned packages, schema, review configuration, and runtime paths were ready.

## Decisions

- Follow the PR #457 decision: do not merge or rewrite divergent legacy history. Carry the frozen develop tree in exactly one new signed, DCO-compliant commit based on current main.
- Treat `origin/develop@af8184734e0735dbeb4491caedb5353efdedcb63` as the semantic source of truth for RC2, with only the two retrospective exceptions enumerated above.
- Preserve `docs/retrospectives/pr-459-develop-main-promotion.md` because it records the prior main promotion and remains historically relevant even though it is absent from develop.
- Keep the release workflow manual and human-approved. This reconciliation does not publish, dispatch, tag, release, merge, or enable auto-merge.

## Accepted risks and tracked follow-ups

- The #490 findings are accepted for the 0.6 release line; this reconciliation does not claim to fix them.
- [#493](https://github.com/midnightntwrk/midnight-did/issues/493), [#494](https://github.com/midnightntwrk/midnight-did/issues/494), and [#495](https://github.com/midnightntwrk/midnight-did/issues/495) remain separate 0.7 follow-ups. Their existence is not evidence that the underlying risks were resolved here.
- Issue #498 and its draft PR track exact-head CI, deterministic tree evidence, routed Pat review, the one-shot promotion/draft gate, and human-only merge authority.

## Validation checkpoint

Before review handoff, this exact tree is required to pass frozen installation, Prettier, low/high dependency audits, release-context/npm publisher/GitHub release/SLSA/repository-policy tests, conformance, docs validation/build, and `pnpm run verify`. Hosted CI and routed review remain current-head requirements after the signed reconciliation commit is pushed.

## Guardrails

This work does not selectively reconstruct develop, import invalid legacy commits, rewrite either protected branch, weaken signature/DCO or release policy, implement #493/#494/#495, enable auto-merge, merge the PR, publish packages or artifacts, dispatch RC2/final, create a release, or create a tag.
