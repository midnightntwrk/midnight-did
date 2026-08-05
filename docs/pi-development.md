# Pi Development Loop

This repository supports Pi as an optional local interface for the pinned
`dev-loops` development workflow. The repository does not require Pi to build,
test, publish, or review code.

## Start a session

From the repository root, after installing and authenticating Pi:

```sh
pi
```

The first session may ask you to trust the repository because it contains
`.pi/settings.json`. Trust is required before Pi loads the project-local
`dev-loops` package.

Check the loop tooling with:

```text
/dev-loops doctor
/dev-loops gates
```

Use the normal issue and pull-request lifecycle from the Pi shell:

```text
/dev-loops start <issue-number>
/dev-loops status <issue-number>
/dev-loops continue <pull-request-number>
```

The exact command help exposed by the installed package is authoritative.

## Repository harness policy

The repository-root `.devloops` file configures the review and lifecycle
policy. It requires refinement, draft-first pull requests, review of DID/API/
package boundaries, and a human-only merge. The file must remain valid for the
pinned `dev-loops@0.9.0` schema; command-level validation and repository rules
remain in `AGENT.md`, the synchronized `midnight-identity` skills, the
pull-request template, and the `./run.sh` validation targets. The current
GitHub default branch is `main`.

The harness is deliberately additive. GitHub Issues, pull requests, protected
branches, and GitHub Actions remain the source of truth for work and CI state.
Pi does not merge pull requests or replace branch protection.

## Shared project skills

Project-local skills are available to Pi through `.pi/settings.json`, which
loads the repository's `.codex/skills` directory. The same generic skills are
mirrored under `.claude/skills` for Claude Code and `.codex/skills` for Codex:

- `ci-triage`: bounded CI monitoring and branch-owned failure classification;
- `agents-pr-review`: read-only external-agent PR review and evidence handling;
- `pr-merge-loop`: guarded stacked-PR operations that respect human-merge policy.

The repository intentionally does not copy personal GitHub-access instructions,
provider-specific Compact optimization notes, or autonomous stack-merging
automation into the project. Those remain operator-specific global skills.

## Automation interfaces

For a wrapper or CI experiment, Pi provides two structured local interfaces:

```sh
pi --mode json "inspect the current worktree"
pi --mode rpc --no-session
```

JSON mode emits newline-delimited session events. RPC mode accepts newline-
delimited JSON commands on standard input and emits responses and agent events
on standard output. Keep either process local; do not expose an unauthenticated
Pi process as a network service.

## Evidence and observability boundary

The Pi shell is the operator interface. GitHub Actions and `gh` remain the
authoritative source for pull-request checks and CI logs. A dev-loop may write
machine-readable lifecycle artifacts under `.pi/harness/`, but those artifacts
are local and ignored by Git.

This repository intentionally does not install or configure ObservMe,
OpenTelemetry, Grafana, Tempo, Loki, Prometheus, or a custom web dashboard at
this stage. Do not record prompts, credentials, tokens, private keys, or raw
cryptographic material in local run artifacts.

## Versioning and trust

The project-local `dev-loops` package is pinned in `.pi/settings.json` so the
workflow does not silently drift. Review changes to that file like executable
tooling: Pi packages and extensions run with the permissions of the invoking
user. Update the pin deliberately and validate the development workflow before
merging.

Check the effective repository configuration before starting work. A config
schema error means the repository-specific policy was not applied and must be
fixed before continuing:

```sh
npx dev-loops@0.9.0 doctor
npx dev-loops@0.9.0 gates
```
