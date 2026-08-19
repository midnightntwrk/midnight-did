---
name: midnight-identity
description: "Use for midnight-did contract/domain/API work, Compact artifacts, package distribution, and DID/VC ownership decisions."
---

# Midnight Identity DID Skill

## Authority

Read repository-root [`AGENT.md`](../../../AGENT.md) first. It is the single
authority for branch roles, worktree discipline, validation, review, commit
integrity, retrospective handling, and public-safe guidance. Do not copy or
redefine those policies here. If this skill and `AGENT.md` disagree, stop and
follow `AGENT.md`.

## Repository boundary

Use this skill only for `midnight-did`-owned surfaces:

- `packages/contract`: DID Compact state and circuits;
- `packages/jubjub-schnorr`: shared Compact/TypeScript Schnorr logic;
- `packages/domain`: DID document schemas and canonicalization;
- `packages/did`: ledger mapping and method resolution helpers;
- `packages/api`: wallet/provider/contract orchestration;
- `w3c-spec` and `docs-site`: the corresponding public specification/docs.

Keep resolver services, manager UI/service, and reusable secret storage in
`midnight-did-resolver`. Keep VC/VP behavior in
`midnight-verifiable-credentials`. Keep product/Passport flows outside this
repository.

## Specialized change rules

- Edit Compact source, never generated `src/managed/**` output by hand.
- Regenerate through package scripts and verify downstream package-name imports.
- Keep `packages/contract`, `domain`, `did`, and `api` aligned when a change
  crosses their boundary.
- Keep JubJub Schnorr transcript logic centralized in `jubjub-schnorr`.
- Update `w3c-spec/` and docs when DID method semantics or public package
  behavior changes.
- Keep coverage provider-neutral and do not let aggregate coverage hide
  security/state-critical modules.
- Package consumers use published package surfaces and published ZK artifact
  locations, not copied `dist/`, managed sources, or proving-key directories.

## Execution

Use the dedicated authoritative worktree and Nix environment required by
`AGENT.md`. Run focused package tests first, then its mandatory repository gate.
For Compact/Schnorr work, include the contract build/tests and managed-artifact
checks. For docs/Nix/browser work, include docs build and visual checks.

Repository-facing commits and PRs follow the exact-head, all-commit signature/DCO,
routed-review, current-head feedback-audit, retrospective, and human-approval
procedures in `AGENT.md`. This skill provides no alternate merge or review path.

## Mirror contract

This file must remain byte-identical under `.codex/skills/` and
`.claude/skills/`; `scripts/check-agent-skills.mjs` enforces the mirror.
