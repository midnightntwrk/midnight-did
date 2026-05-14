# Repository Boundary and Workspace Policy

## Purpose

This repository is a reference implementation focused on the `did:midnight` DID method and its core services.
The boundary below separates canonical, actively maintained packages from optional legacy artifacts and local runtime outputs.

Use this document to keep onboarding and automation steps aligned with the code that is actually tracked in this branch.

## Canonical workspaces (tracked, in scope)

- `api`
- `cli`
- `contract`
- `did`
- `did-resolver-service`
- `domain`

These are the only npm workspaces declared in root `package.json` and are the packages validated by CI.

## Canonical helper modules (tracked, in scope)

- `schemas/compact-vc` — canonical VC schema definitions and deterministic hash vectors for
  identity/role/compliance examples.

## Canonical developer entrypoint

- `./run.sh` — full repo workflow used by CI (lint, build, tests, coverage)
- `npm run checkdeps` — dependency boundary check
- `scripts/check-deps.sh` — direct script for package boundary checks
- `docs/runtime-shim.md` — why the onchain runtime shim is required

## Explicitly out-of-scope for this branch

The directories below are present in this checkout for local experimentation or previous work, but they are **not part of the active tracked workspace surface** in this branch:

- `credentials/`
- `credentials-birth/`
- `credentials-birth-secret/`
- `credentials-demo-contract/`
- `credentials-iso-registry/`
- `credentials-openid/`
- `credentials-protocol/`
- `credentials-same-holder/`
- `did-manager-service/`
- `midnight-passport-prototype/`
- `secret-storage/`
- `proof-server-bootstrap/`
- `review/`
- `docs-site/`
- `api/.midnight-db/`
- `.turbo/`

When these directories are not intentionally edited, avoid opening PRs that modify them directly and remove local generated
state before opening a pull request.

## Local cleanup recommendations

Use one of:

- `npm run clean:local-state` (removes stale local test/build artifacts in the repo root)
- `npm run clean` (runs each workspace cleanup script where defined)
- `git clean -fd .turbo api/.midnight-db docs-site review` (when you are done with local-only artifacts)

## Scope checks for contributors

Before opening PRs touching docs or CI:

1. keep scripts/docs aligned to `./run.sh`
2. avoid new edits to out-of-scope directories above unless explicitly coordinated
3. include evidence for any new out-of-scope folders in `review/repository-audit-backlog-*.md`
