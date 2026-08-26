---
name: agents-pr-review
description: Use this for an explicitly requested local second-opinion PR review by Claude Code or Antigravity installed on this machine. Run one or both local CLIs against a GitHub pull request URL, wait up to five minutes for each output, and summarize actionable findings. This is distinct from the GitHub-routed agent-review skill.
---

# Local Agents PR Review

Use this skill only for the **local-CLI review mode**: an operator explicitly asks
for Claude Code, Antigravity (`agy`), or another reviewer CLI configured on this
machine to inspect a PR.

This skill is intentionally separate from the `agent-review` skill supplied by
`@input-output-hk/agent-review-pi`:

| Mode | Select when | Transport | Result |
| --- | --- | --- | --- |
| Local second opinion (this skill) | The user names a local reviewer/CLI, asks for a local review, or asks to run configured agents | `claude`/`agy` in the local checkout | Advisory output saved under `review/`; no GitHub review request or review submission |
| Routed peer review (`agent-review`) | The user asks for an engineer's/peer agent's review, an `ai-review`, or the repository's GitHub review convention | GitHub `ai-review` label + native review request/claim tools | A pinned, native GitHub review; the anchor/enricher panel protocol applies |

Routing rules:

- Prefer the routed `agent-review` mode for an unqualified “peer review” or
  “request a review” request when that integration is installed.
- Use this local mode only when local execution is explicit or the routed
  integration is unavailable and the user accepts the fallback.
- Do not run both modes by default. Run both only when the user explicitly asks
  for local and routed reviews.
- A local result is advisory evidence and does not satisfy a GitHub review
  request, label, claim, or approval gate. Conversely, a routed review must not
  be replaced by a local CLI run.

For this repository's SDLC, the routed lane requests Pat Losoponkul
(`patextreme`) by default and applies the `ai-review` label. The dispatch helper
uses the pinned `@input-output-hk/agent-review-pi@0.5.0` integration. It requires
the user-owned `~/.agent-peer-review/config.json`; if that file is missing or
invalid, stop and ask the user to run:

```bash
node .pi/npm/node_modules/@input-output-hk/agent-review/dist/cli/index.js init --repo midnightntwrk/midnight-did
```

Never create or copy the user's GitHub credentials into the repository.

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
- Treat local agent output as input to verify, not as a final answer.

## When to run it

Run a fresh **local** review only when the local mode was selected by the
routing rules above, for example:

- the user explicitly asks for Claude, Antigravity, `agy`, or configured local agents
- the user asks to rerun the local second opinion after substantive changes
- a merge-loop operator explicitly selects local review as the repository's review route

Do not start this skill merely because a PR was opened or updated when the
repository uses the GitHub-routed `agent-review` convention.

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
- Treat local CLI output as advisory evidence; verify every finding against the
  pinned/current PR head before changing code.
- This skill never calls `review_create`, `review_claim`, `review_complete`, or
  `review_enrich`, and never adds/removes GitHub review labels or requests.
- Do not mark a PR ready or merge it from this review skill; leave lifecycle
  transitions to the repository's dev-loop and human approval policy.
- If a requested local agent is unavailable or authentication is missing, report
  that plainly and continue with any other explicitly requested local agent.
- Keep the PR URL exact; do not substitute branch diffs when the user explicitly asked for PR review.
- Prefer direct commands and a 5-minute wait before switching to background execution.
- Keep review artifacts inside the workspace `review/` directory unless the user explicitly asks for another location.
