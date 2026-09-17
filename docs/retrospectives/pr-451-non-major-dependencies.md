# PR #451: Non-major dependency refresh retrospective

Date: 2026-09-01
Canonical tracker: [midnightntwrk/midnight-did PR #451](https://github.com/midnightntwrk/midnight-did/pull/451)

## What prompted the work

Renovate grouped a pnpm update with `js-yaml` and `protobufjs` updates, but did
not produce a matching lockfile. The branch was also behind the validated
Vitest and Turbo update merged through PR #454.

## What worked

- Current `develop` was merged into the bot branch without rewriting the
  Renovate commit.
- pnpm 10.34.5 was exercised through Corepack in the repository Nix shell.
- The existing lockfile installs unchanged with pnpm 10.34.5 in frozen mode.
- Renovate's refreshed branch had already removed the superseded CodeQL
  `upload-sarif` update that landed through PR #455.

## Friction and failures

- `protobufjs` 7.6.6 was only four days old and failed pnpm's seven-day
  `minimumReleaseAge` policy.
- Raising the direct `js-yaml` version alone left the security override at
  `^4.3.1`; raising both then correctly exposed that 4.3.2 was only five days
  old and also failed the seven-day policy.
- A grouped Renovate stability status did not demonstrate that every member of
  the group could pass pnpm's repository-level maturity enforcement.

## Decisions

- Retain only the mature pnpm 10.34.5 update in this release train.
- Keep `js-yaml` at 4.3.1 and `protobufjs` at 7.6.5 until normal Renovate
  refreshes can satisfy the existing seven-day rule.
- Do not add maturity exclusions, edit the lockfile manually, or weaken
  supply-chain policy to expedite these packages.
- Preserve the PR #454 dependency tree and PR #455 CodeQL action pin.

## Tracked follow-up actions

- PR #451 tracks exact-head CI, routed peer review, and human merge approval.
- Allow Renovate to propose the deferred `js-yaml` and `protobufjs` updates
  again after they meet repository policy.
- PR #452 remains open and unmerged pending dedicated Midnight runtime and
  proving-stack compatibility work.

## Guardrails

This repair does not alter production dependencies, DID semantics, Compact
artifacts, workflow permissions, protected-branch policy, or the human-only
merge rule.
