---
name: midnight-identity
description: "Use this skill for midnight-did repository work: DID contract/domain/API package development, run.sh validation, Compact artifacts, package distribution, and DID/VC split-boundary decisions."
---

# Midnight Identity DID Skill

Use this skill from the `midnight-did` repository.

## Required Context

1. Read repository-root `AGENT.md` first.
2. Keep VC use cases, university BDD, and Passport/product flows out of this repository; those belong in VC or examples repos.

## Defaults

- Target branch is `develop` unless instructed otherwise.
- Use DCO/GPG for repository-facing commits: `git commit -S --signoff -m "<type>: <subject>"`.
- Treat `~/.midnight-did` as sensitive local state.

## PR Gate (required before any PR)

- Mandatory:
  - `./run.sh --light --strict`
  - `./run.sh core --strict`
  - `./run.sh integration-report`

Do not open or push PRs before completing this gate.

## Validation

```bash
./run.sh targets
./run.sh --light
./run.sh --light --strict --metrics
./run.sh core --strict
./run.sh api --light
./run.sh docs
./run.sh clean-artifacts
./run.sh integration-report
./run.sh check-integration
pnpm run check:run-target-catalog
PROOF_SERVER_IMAGE=proof-server-bootstrap:8.0.3 ./run.sh
```

Resolver service, DID manager, and secret-storage validation moved to the
`midnight-did-resolver` repository; do not add those targets back here.

For shared JubJub Schnorr or contract changes, run `pnpm --filter ./packages/contract test`.

## Packaging

```bash
pnpm run artifacts:pack
./upgrade-libs.sh --destination /path/to/downstream-repo
```

Do not hand-copy `dist/` or `src/managed/`; fix package `files` and build/prepack behavior instead.

## MCP

Use a user-level Midnight MCP config when available; do not commit personal MCP files:

```toml
[mcp_servers.midnight]
command = "pnpm"
args = ["dlx", "midnight-mcp@latest"]
```
