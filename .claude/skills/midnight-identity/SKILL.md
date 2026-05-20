---
name: midnight-identity
description: "Use this skill for midnight-did repository work: DID contract/domain/API package development, run.sh validation, Compact artifacts, DID manager/resolver workflows, secret storage, package distribution, and DID/VC split-boundary decisions."
---

# Midnight Identity DID Skill

Use this skill from the `midnight-did` repository, whether cloned independently or as a submodule.

## Required Context

1. Read repository-root `AGENT.md` first.
2. If this checkout is inside `midnight-identity-workspace`, read the workspace-root `AGENT.md` for submodule and artifact fanout rules.
3. Keep VC use cases, university BDD, and Passport/product flows out of this repository; those belong in VC or examples repos.

## Defaults

- Target branch is `develop` unless instructed otherwise.
- Use DCO/GPG for repository-facing commits: `git commit -S --signoff -m "<type>: <subject>"`.
- Treat `~/.midnight-did` as sensitive local state.

## Validation

```bash
./run.sh --light
./run.sh --light --strict --metrics
./run.sh core --strict
./run.sh api --light
./run.sh resolver --light
./run.sh manager --light
./run.sh docs
PROOF_SERVER_IMAGE=proof-server-bootstrap:8.0.3 ./run.sh
```

For shared JubJub Schnorr or contract changes, run `npm run test -w ./packages/contract`.

## Packaging

```bash
npm run artifacts:pack
./upgrade-libs.sh --destination /path/to/downstream-repo
```

Do not hand-copy `dist/` or `src/managed/`; fix package `files` and build/prepack behavior instead.

## MCP

Use a user-level Midnight MCP config when available; do not commit personal MCP files:

```toml
[mcp_servers.midnight]
command = "npx"
args = ["-y", "midnight-mcp@latest"]
```
