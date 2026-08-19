---
name: pr-merge-loop
description: Use when working through a stacked pull-request queue and you need Codex to watch PRs, run review gates, merge bottom-up when CI is green, rebase follow-up branches, and stop on real failures.
---

# PR Merge Loop

## Overview

Use this skill for a bounded merge queue of related PRs, especially stacked PRs.

The goal is mechanical but strict. It must also respect the repository's
configured human-approval policy:

- watch PR status
- enforce review gates
- merge bottom-up when ready
- rebase or retarget the next PR
- stop immediately on real failures

This skill is for **active merge execution**, not generic GitHub browsing.

## When To Use

Use this skill when all of these are true:

- there is a known PR queue
- merge order matters
- CI is the primary remaining gate
- the user wants Codex to drive the merge/rebase loop

Typical cases:

- stacked PR backlog work
- docs/code split PR chains
- one feature followed by additive cleanup PRs
- merge train for a small repo maintenance campaign

## Preconditions

- confirm the local repo matches the PRs
- confirm push and merge permissions exist
- confirm required review gates are known
- prefer `gh` plus local git, not manual browser work

For private GitHub access, use the operator's configured GitHub authentication
without committing tokens or personal access instructions.

## Review-route selection

This skill does not choose between the two PR-review integrations by wording
alone. Select exactly one route per PR unless the operator explicitly asks for
both:

- **GitHub-routed peer review (preferred when configured):** use the `agent-review`
  skill and its `ai-review` label/native request, claim, and completion
  convention. This is the review of record for the engineer's agent.
- **Local second opinion:** use `agents-pr-review` only when the operator
  explicitly selects Claude Code/Antigravity or local configured agents. Its
  output is advisory and does not create GitHub review evidence.

An unqualified “peer review” or “request a review” means the GitHub-routed route
when it is installed. Never silently run both routes, and never count a local
CLI transcript as a substitute for a requested GitHub review.

## Default Merge Gates

Resolve the repository's actual default/base branch from GitHub; do not assume
`develop`.

For repositories with `humanMergeOnly` or an equivalent dev-loop policy, stop
before merge and report readiness. Explicit user authorization does not override
that repository invariant; only an explicit policy/configuration change can.

Do not merge a PR until all of these are true:

1. PR is not draft
2. PR is mergeable
3. required CI checks are green
4. the selected review route is complete
5. all blocking findings from that route are fixed and verified
6. every PR commit has current accepted GitHub-verified signature and DCO evidence when the repository requires it

If any gate is unclear, report it explicitly before merging.

## Required Review Discipline

For each PR in the queue:

1. select the review route using the policy above
2. complete that route against the exact PR URL/head
3. fix blocking findings before merge
4. rerun the selected route after substantive fixes when the PR changed materially

For the GitHub-routed route, follow the `agent-review` skill's pinned-SHA,
anchor/enricher, and native completion protocol. For the local route, follow
`agents-pr-review`; save its advisory artifact under `<repo>/review/` when
useful. Do not use a local transcript to satisfy GitHub review-request or
approval evidence.

## Execution Loop

### 1. Identify the queue

Work from the bottom PR upward.

Track for each PR:

- PR number and URL
- base branch
- head branch
- draft/ready state
- mergeability
- CI state
- review state

### 2. Watch sparingly

Poll status with restraint.

Prefer:

- one direct status check
- then a longer wait
- then another check

Do not spam busy polling.

### 3. Merge the bottom ready PR

When the bottom PR is fully green and mergeable:

- merge it only when the repository policy allows agent-controlled merge;
  obtain explicit user authorization wherever that policy permits agent merge
- confirm merged state
- note merge time or merge commit if useful

### 4. Repair the next PR in line

After a lower PR merges:

- rebase the next PR onto the updated default branch or the correct new base
- resolve conflicts carefully
- reverify signature/DCO policy for every rewritten commit, tree identity, and range-diff evidence if the repo requires them
- force-push with `--force-with-lease`
- rerun the smallest relevant local validation if the rebase was non-trivial

### 5. Repeat

Continue until:

- the queue is merged
- a PR fails for a real reason
- or the stack becomes too stale/risky and needs a reset

## Stop Rules

Stop immediately if:

- a baseline PR fails CI for a real reason
- mergeability changes to conflicting and needs real conflict resolution
- the selected review route finds a critical issue not yet fixed
- the next PR depends on assumptions invalidated by the merge below it
- stack depth or drift makes another stacked step low quality

When stopped:

- summarize the blocker
- fix the blocker or ask for direction only if blocked on user intent

## Rebase Rules

Prefer:

- `git rebase --autostash <base>`
- `git push --force-with-lease`

Do not:

- use destructive reset shortcuts
- rewrite unrelated branches casually
- leave higher PRs on stale bases after lower merges

## CI Triage Rule

If a PR is red:

- inspect the first real failing job
- reproduce locally when feasible
- patch the smallest correct fix
- preserve branch reviewability

Use the repository's `ci-triage` skill when the failure is not obvious from
the PR summary.

## Suggested Output Style

When using this skill, report progress in a short operational form:

- what PRs are in queue
- which PR is ready now
- what is still running
- what was merged
- what was rebased
- what blocked the loop

## Optional Automation

If the user wants ongoing monitoring across time, pair this skill with a thread heartbeat automation.

Good automation task:

- wake up periodically
- inspect the bottom PR in the queue
- merge when all gates are green
- rebase the next PR
- stop and report on real failures
