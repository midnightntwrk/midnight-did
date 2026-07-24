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
