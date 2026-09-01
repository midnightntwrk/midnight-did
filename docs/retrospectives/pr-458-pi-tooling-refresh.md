# PR #458: Pi tooling refresh retrospective

Date: 2026-09-01
Canonical tracker: [midnightntwrk/midnight-did PR #458](https://github.com/midnightntwrk/midnight-did/pull/458)

## What prompted the work

The requested agent-review upgrade was evaluated against the current
`origin/develop` branch rather than the stale primary checkout. Develop already
contained `@input-output-hk/agent-review-pi@0.6.0`, so the work expanded only to
the other project-local Pi packages that had a justified stable update.

## What worked

- Registry metadata confirmed agent-review 0.6.0 and dev-loops 0.9.0 remain
  their stable `latest` releases, while pi-subagents 0.62.0 supersedes the
  pinned 0.42.1 release.
- Clean, serial provisioning inside the dedicated Nix worktree installed the
  exact direct pins and transitive `@input-output-hk/agent-review@0.6.0` without
  audit findings.
- Pi 0.83.0 loaded the extensions, listed pi-subagents capabilities, and ran a
  read-only builtin reviewer child successfully.
- Focused harness tests, the repository diagnostic, an independent review, and
  the complete `pnpm run verify` gate passed.

## Friction and failures

- The primary checkout still exposed an ignored 0.4.0 installation, which was
  not authoritative for the current develop branch.
- An early parallel analysis reproduced the existing package-provisioning race:
  two Pi startups mutated the same ignored `.pi/npm` tree and npm failed with
  `ENOTEMPTY`. The final validation therefore used a clean, serial install.
- Pi-subagents moved project state from `.pi-subagents/` to `.pi/subagents/`
  after the old pin. Durable schedules and missions are not automatically
  migrated, so the upgrade needed explicit operator guidance rather than only a
  version edit.
- The packaged dev-loops agents still advertise Claude-style tool names that Pi
  does not register. This is a pre-existing upstream integration gap and was not
  hidden by the package refresh.

## Decisions

- Retain agent-review 0.6.0 because develop already has the requested current
  stable release.
- Upgrade pi-subagents to 0.62.0 and cover both its current and legacy local
  runtime-state paths in repository diagnostics and ignore policy.
- Retain dev-loops 0.9.0. The 1.0.0 release candidate requires a coupled Pi,
  schema, and harness migration and is not a drop-in stable update.
- Do not add pi-taskflow as a project pin. It remains an optional peer for the
  shipped agent-review taskflows, not a requirement for the repository's native
  review tools and skill.

## Tracked follow-up actions

- PR #458 tracks exact-head CI, routed peer review, and human merge approval for
  this refresh.
- `docs/harness-upstream-follow-ups.md` continues to track Pi-valid dev-loops
  agent allowlists and serialized/atomic project package provisioning.
- Existing checkouts with legacy durable schedules must finish or remove them
  before upgrading and intentionally recreate still-needed schedules under the
  current state root.

## Guardrails

This change does not alter DID semantics, Compact sources or generated
artifacts, published package dependencies, protected-branch policy, global Pi
configuration, review credentials, taskflow installation policy, or the
human-only merge rule.
