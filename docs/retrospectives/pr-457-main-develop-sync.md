# PR #457: main-to-develop content synchronization retrospective

Date: 2026-08-31
Canonical tracker: [midnightntwrk/midnight-did PR #457](https://github.com/midnightntwrk/midnight-did/pull/457)

## What prompted the work

PR #456 landed the agent-review 0.6.0 alignment directly on `main` while the
controlled release work and draft PRs #448, #449, and #450 remained based on
`develop`. The package alignment and main-only retrospective records therefore
had to reach `develop` before continuing the merge train.

## What worked

- The synchronization used an isolated worktree based on the exact fetched
  `origin/develop` tip and left the dirty primary checkout untouched.
- The final branch preserves the newer `develop` implementation and differs
  from its pre-sync tree in only seven files: five agent-review 0.6.0
  references or fixtures and two main-only retrospective records.
- The PR #456 content was applied as one new signed, DCO-compliant commit rather
  than rewriting either protected branch or weakening commit-integrity policy.
- Project-local provisioning resolved both agent-review packages at 0.6.0.
  Focused harness checks, strict light/core gates, the integration report, and
  the full API integration suite passed.

## Friction and failures

- A normal recursive history merge exposed conflicts across release workflows,
  package manifests, DID/API implementation, conformance evidence, and harness
  files. Most were historical conflicts between squash-style promotions and
  newer `develop` work, not independent changes that should be recombined.
- A resolved history-preserving merge passed the repository test suite but
  failed the exact PR commit-integrity preflight. Two already-published historic
  main commits, `b7392676` and `6a2eff83`, do not satisfy the current DCO rules.
  Rewriting protected history or adding a policy bypass would be unsafe.
- The branch divergence had grown to 22 main-only and 26 develop-only commits.
  Current policy therefore permits a bounded content synchronization but not a
  direct history merge of those legacy commits.

## Decisions

- `develop` remains the semantic source of truth for current DID, API, release,
  and harness behavior during this back-sync.
- Synchronize the bounded current-main delta as new signed content rather than
  importing historic commits that fail today's integrity gate.
- Preserve the strict commit policy. Do not rewrite published history and do not
  create exemptions merely to make the synchronization mergeable.
- Keep this synchronization separate from the feature merge train and the final
  `develop`-to-`main` promotion.

## Tracked follow-up actions

- PR #457 tracks exact-head CI, peer review, and human approval for this content
  sync.
- After #457 merges, refresh and merge #448, #449, and #450 into `develop` in
  that order, with new exact-head validation and review whenever a branch SHA
  changes.
- The final promotion must use a main-based reconciliation branch carrying the
  validated frozen `develop` tree as signed content, unless commit policy is
  changed through a separately reviewed governance decision.

## Guardrails

This synchronization does not merge any feature or dependency PR, promote
`develop` to `main`, enable auto-merge, publish packages, rewrite protected
history, weaken DCO enforcement, or alter global agent-review credentials.
