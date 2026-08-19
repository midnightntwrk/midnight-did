---
name: ci-triage
description: >
  Inspect and triage CI for a branch or PR. Select dev-loop wrapper-only mode
  when invoked by dev-loop; use raw-gh standalone mode only outside dev-loop.
---

# CI triage

## Select one mode

### Dev-loop mode — wrapper only

Use this mode whenever the handoff came from `dev-loop`. The validated handoff
envelope's sanctioned-command map is authoritative. Do not use raw `gh pr
view`, `gh pr checks`, `gh run view`, or `gh api`; do not shell-poll.

Prefer the pinned project-local CLI and wrappers:

```bash
node .pi/npm/node_modules/dev-loops/cli/index.mjs loop info --pr <n>
node .pi/npm/node_modules/dev-loops/scripts/github/probe-ci-status.mjs --repo <owner/name> --pr <n> --timeout-ms 0
node .pi/npm/node_modules/dev-loops/scripts/github/fetch-ci-logs.mjs --repo <owner/name> --pr <n> --failed-only --tail 200
node .pi/npm/node_modules/dev-loops/cli/index.mjs loop watch-ci --repo <owner/name> --pr <n>
```

Treat a missing wrapper as a tooling gap; do not improvise a raw call inside the
dev-loop. Fix only branch-owned failures and return the exact failing check,
first actionable error, classification, and validation needed after a fix.

### Standalone mode — raw gh allowed

Use this mode only for an explicitly standalone CI investigation that is not a
dev-loop handoff. Raw GitHub CLI reads are then allowed:

```bash
gh pr view <pr> --json number,url,headRefName,baseRefName,mergeable,reviewDecision,statusCheckRollup
gh run list --branch <head-branch> --limit 20 --json databaseId,name,status,conclusion,headSha,url
gh run view <run-id> --json jobs,conclusion,status,url
gh run view <run-id> --log-failed
gh run watch <run-id>
```

Use `gh api repos/<owner>/<repo>/actions/jobs/<job-id>/logs` only when the normal
run-log command cannot return the log. Do not rerun workflows unless authorized.

## Common triage contract

1. Confirm the PR's actual base and exact head; never assume a branch role.
2. Identify the first real failing job and error.
3. Classify it as branch-owned build/test/config or external infrastructure,
   credentials, runner, or upstream service failure.
4. Reproduce branch-owned failures locally when practical and patch the
   smallest correct slice.
5. After a push, discard old-head evidence and rerun the selected mode.
6. Never print credentials or use `set -x`.

This skill does not merge and does not turn green CI into review approval.
