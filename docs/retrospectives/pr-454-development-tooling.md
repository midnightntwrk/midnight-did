# PR #454: Renovate development tooling retrospective

Date: 2026-09-01
Canonical tracker: [midnightntwrk/midnight-did PR #454](https://github.com/midnightntwrk/midnight-did/pull/454)

## What prompted the work

Renovate proposed a grouped development-tooling update, but the branch lacked a
matching lockfile and conflicted after PR #435 landed overlapping TypeScript
ESLint, Testcontainers, and Turbo updates on `develop`.

## What worked

- Conflict resolution used a dedicated worktree and the exact fetched PR and
  `develop` tips.
- Current `develop` remained authoritative for the TypeScript ESLint 8.67.0 and
  Testcontainers 12.1.0 versions already validated in PR #435.
- The remaining Renovate delta was reduced to Vitest/coverage 4.1.11 across all
  package manifests and Turbo 2.10.11 at the root.
- The lockfile was regenerated with pnpm 10.34.4, and a frozen installation
  succeeded.

## Friction and failures

- The bot branch changed seven manifest entries without updating
  `pnpm-lock.yaml`, so every install-based CI lane failed before tests ran.
- PR #435 changed the same root tooling block, making the bot branch conflict
  even after Renovate refreshed it.
- Exact-head CI and review must be repeated after the maintainer merge commit.

## Decisions

- Merge current `develop` into the bot branch without rewriting the verified
  Renovate commit.
- Preserve the already-landed PR #435 versions and retain only the newer
  non-duplicated Turbo and Vitest updates from PR #454.
- Regenerate the lockfile from final manifests instead of manually editing it.
- Exclude the held Midnight runtime and proving-stack update in PR #452.

## Tracked follow-up actions

- PR #454 tracks exact-head CI, routed peer review, and human merge approval.
- Refresh PR #451 after #454 lands so its independent package-manager,
  `js-yaml`, and `protobufjs` updates regenerate against the final tooling lock.
- PR #452 remains open and unmerged pending dedicated compatibility work.

## Guardrails

This change does not alter production dependencies, DID semantics, Compact
artifacts, workflow permissions, protected-branch policy, or the human-only
merge rule.
