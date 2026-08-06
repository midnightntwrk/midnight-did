---
name: ci-triage
description: >
  Quick workflow to review, monitor, and triage CI jobs for a GitHub branch or PR using gh. Use after Codex creates a PR and needs to keep an eye on required checks, fetch failing logs, summarize root causes, and propose or apply fixes.
---

# CI triage shortcut

## Quick commands

- List recent runs for current branch: `gh run list --limit 15 --json databaseId,status,conclusion,name,headBranch,headSha,workflowName`
- View logs of a run/job: `gh run view <run-id> --log`
- Download artifacts: `gh run download <run-id> --name <artifact> -D /tmp/artifacts`
- Rerun failed: `gh run rerun <run-id> --failed`

## PR monitoring loop

Use this after opening a PR, especially for PRs Codex created.

For repositories managed by dev-loops, use the package's bounded wrappers
first (`loop info --pr`, `probe-ci-status.mjs`, and `fetch-ci-logs.mjs`) rather
than raw `gh` reads when the wrapper covers the needed fact.

1. Capture PR state:
   `gh pr view <pr> --json number,url,headRefName,baseRefName,mergeable,reviewDecision,statusCheckRollup`
2. List branch runs:
   `gh run list --branch <head-branch> --limit 20 --json databaseId,name,status,conclusion,headSha,url`
3. If checks are queued or in progress, use `gh run watch` or the repository's
   bounded watch helper. Do not use unbounded shell polling or repeated sleeps.
4. If a check fails, inspect the failing job:
   `gh run view <run-id> --json jobs,conclusion,status,url`
5. Fetch logs through the job log API if `gh run view --log-failed` is empty:
   `gh api repos/<owner>/<repo>/actions/jobs/<job-id>/logs > /tmp/<job-id>.log`
6. Fix only actionable branch-owned failures. Treat permission, secret, runner outage, and upstream service failures as external unless a repository configuration change is clearly needed.
7. After pushing a fix, verify the PR now points at the new head SHA and restart the loop.

## Triage steps

1. Identify failing workflows/jobs for the branch/PR.
2. Pull logs for the failing job(s) with `gh run view --log`.
3. Extract the first error stack/exit reason; classify:
   - Infra (Docker/Testcontainers API mismatch, network, missing scopes/creds)
   - Build (compile/format/test failures)
   - Env/config (wrong TESTS_CONFIG, missing image versions)
4. Propose fix:
   - For infra/API mismatches: set envs (e.g., DOCKER_API_VERSION), align versions.
   - For test failures: pinpoint failing test, suggest code/config change.
   - For missing secrets/scopes: note required secret/scope.
5. Report succinctly to the user: failing workflow/job, root cause, suggested fix, next command to rerun.

## Guardrails

- Do not print secrets; avoid `set -x`.
- Respect branch protections; do not rerun workflows unless asked.
