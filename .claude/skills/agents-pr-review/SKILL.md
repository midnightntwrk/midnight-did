---
name: agents-pr-review
description: Use this when the user wants a second-opinion PR review from external coding agents such as Claude Code or Antigravity. Run one or both agents against a GitHub pull request URL, wait up to five minutes for each output, and summarize actionable findings. Store output under the workspace review/ directory when persistence is useful.
---

# Agents PR Review

Use this skill when the user wants another agent's point of view on a pull request.

## Preconditions

- Run from the relevant local git repository or a dedicated worktree; do not
  use a dirty primary checkout for review or fixes.
- Ensure the requested agent CLI is installed and authenticated.
- Prefer the repository that matches the PR URL.
- Resolve and verify the PR's actual base branch; do not assume `develop`.
- For dev-loop-managed work, preserve draft-first status until the configured
  draft gate has passed.
- Prefer a workspace-local output directory at `<workspace-root>/review/` when you want to keep the review artifact.

## Default commands

Use direct commands first. Run them from the repository with `bash` semantics and wait up to 5 minutes per agent.

Claude Code:

```bash
cd <repo>
claude -p "/review <PR_URL>"
```

Antigravity:

```bash
cd <repo>
agy -p "Review this pull request: <PR_URL>. Focus on correctness, security, tests, docs, and release risk. Return actionable findings with file references."
```

Notes:

- The command is `/review`, not `/reivew`.
- In Codex shell usage, run it with `shell="bash"` and `login=true` when possible.
- Give each agent up to 5 minutes before deciding it is hung or silent.
- Treat external agent output as input to verify, not as a final answer.

## When to run it

Run a fresh agent review:

- after opening a new PR
- after pushing new commits to an existing PR
- after addressing substantive review feedback
- when the user asks for Claude, Antigravity, `agy`, or multi-agent PR review

Overwrite the same artifact file if you want the latest review for that PR, or use a timestamped variant if the history matters.

## Recommended interactive pattern

1. Change to the local repository that matches the PR.
2. Verify CLI availability with `command -v claude` or `command -v agy`; check auth only if the command fails.
3. Run the direct command for the requested agent. If the user asks for multiple agents, run them independently and compare results.
4. Wait up to 5 minutes per agent for output.
5. Verify concrete claims against the local checkout before presenting them as findings.
6. Summarize findings by severity and map them to concrete fixes.
7. If fixes are made, rerun the same review command against the same PR.

## Persistent artifact pattern

Use this when you want to keep the review output under the workspace root.

Claude Code:

```bash
mkdir -p <workspace-root>/review
cd <repo>
claude -p "/review <PR_URL>" \
  | tee <workspace-root>/review/<repo>-<pr-number>.claude-review.txt
```

Antigravity:

```bash
mkdir -p <workspace-root>/review
cd <repo>
agy -p "Review this pull request: <PR_URL>. Focus on correctness, security, tests, docs, and release risk. Return actionable findings with file references." \
  | tee <workspace-root>/review/<repo>-<pr-number>.agy-review.txt
```

Filename pattern:

- text: `<repo>-<pr-number>.<agent>-review.txt`
- json: `<repo>-<pr-number>.<agent>-review.json`

## Optional JSON mode

Use this only when machine-readable output is actually needed and the selected agent supports JSON output.

```bash
mkdir -p <workspace-root>/review
cd <repo>
claude -p "/review <PR_URL>" --output-format json \
  | tee <workspace-root>/review/<repo>-<pr-number>.claude-review.json
```

## Optional fire-and-forget pattern

Use this only when you explicitly want background execution. In this environment it has been less reliable than the direct command.

```bash
mkdir -p <workspace-root>/review
cd <repo>
( claude -p "/review <PR_URL>" > <workspace-root>/review/<repo>-<pr-number>.claude-review.txt 2>&1; \
  printf "%s\n" "$?" > <workspace-root>/review/<repo>-<pr-number>.claude.exitcode \
) >/dev/null 2>&1 &
echo $! > <workspace-root>/review/<repo>-<pr-number>.claude.pid
```

Polling helpers:

```bash
tail -n 200 <workspace-root>/review/<repo>-<pr-number>.claude-review.txt
ps -p "$(cat <workspace-root>/review/<repo>-<pr-number>.claude.pid)" -o pid=,etime=,command=
cat <workspace-root>/review/<repo>-<pr-number>.claude.exitcode 2>/dev/null || true
```

## Guardrails

- Do not invent review findings if the command fails or produces no output.
- Treat external review as advisory evidence; verify every finding against the
  current PR head before changing code.
- Do not mark a PR ready or merge it from this review skill; leave lifecycle
  transitions to the repository's dev-loop and human approval policy.
- If a requested agent is unavailable or authentication is missing, report that plainly and continue with any available requested agents.
- Keep the PR URL exact; do not substitute branch diffs when the user explicitly asked for PR review.
- Prefer direct commands and a 5-minute wait before switching to background execution.
- Keep review artifacts inside the workspace `review/` directory unless the user explicitly asks for another location.
