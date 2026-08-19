# Issue #428: develop-to-main promotion retrospective

## Checkpoint

- Promotion issue: [#428](https://github.com/midnightntwrk/midnight-did/issues/428)
- Source: `origin/develop` at `b5ed09e50fda013cb268659b4726a6fad0e7f33d`
- Target: `origin/main` at `e4e6f477ffebc56b3fd2bffcb707c9d7443cc5f4`
- Branch: `codex/sync-develop-to-main-20260819-184608`
- Merge commit: `1c109f1cb1a7b3fc0ad08095fb16a251c48bdd57`

## What worked

Fetching both remote branch tips before branching made the promotion boundary reproducible. Merging `origin/main` with a signed, DCO-compliant merge commit retained both histories without rebasing or squashing. The earlier develop-side baseline synchronization in `2058bf319a87b0c190843b968b2806343925171f` already contained the release fixes from main, including `e4e6f477ffebc56b3fd2bffcb707c9d7443cc5f4`, so resolving textual conflicts to the newer develop versions produced a merge tree byte-identical to the fetched develop tree.

## What failed or caused friction

The requested handoff files `context.md` and `plan.md` were not present in the isolated worktree. The explicit task and `AGENT.md` still provided enough policy to proceed. Git reported conflicts across DID implementation/tests, W3C evidence, and review-harness files because the main release history had previously been synchronized through a squash-style GitHub promotion/back-sync path rather than shared merge ancestry.

## Conflict decisions

All conflicts retained the develop-side file versions. This was a semantic choice rather than a blanket preference for novelty: develop's `2058bf3` already incorporated the main release baseline and `e4e6f47` review fixes, while subsequent `d76ac67` DID Core consistency work and `b5ed09e` harness hardening superseded overlapping text. After resolution, `git diff --exit-code origin/develop <merge-head>` succeeded, and both fetched heads were ancestors of the merge commit.

## Configuration drift and process gaps

The missing handoff artifacts are a runner-coordination gap. The high conflict count also shows that squash-based promotions obscure content equivalence and make later history-preserving synchronization noisy even when the desired tree is unambiguous. Neither gap justifies rewriting release history during this promotion.

## Tracked follow-up actions

- Issue #428 tracks exact-head commit verification, external Pat review, feedback audit, CI triage, and clean handoff for this promotion.
- Record any missing-handoff recurrence or failed review/CI state on #428 with the exact affected head so it remains actionable rather than implicit.

## Guardrails

This promotion does not merge the pull request, enable auto-merge, publish packages, create tags, or create a release. Review dispatch is only a request; acceptance requires current-head external evidence and a successful feedback audit.
