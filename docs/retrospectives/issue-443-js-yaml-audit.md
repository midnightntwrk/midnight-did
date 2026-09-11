# Issue #443: js-yaml security update and explicit audit gate retrospective

Date: 2026-09-10
Canonical tracker: [midnightntwrk/midnight-did issue #443](https://github.com/midnightntwrk/midnight-did/issues/443)
Superseded pull request: [midnightntwrk/midnight-did PR #470](https://github.com/midnightntwrk/midnight-did/pull/470)

## What prompted the work

Renovate PR #470 identified GHSA-2883-xcg3-v3hh in `js-yaml` 4.3.1, but its
branch omitted the lockfile update and failed frozen-install CI. The release
readiness review also found that Quality skipped all dependency setup and audit
work for non-code changes, so install-time audit suppression had no explicit
CI audit counterpart.

## What worked

- The replacement started from exact current `origin/develop` and retained the
  reviewed `js-yaml@4.3.2` maturity exclusion rather than weakening the global
  seven-day policy.
- pnpm 10.34.5 produced a focused lockfile refresh and the refreshed lockfile
  passed frozen installation.
- `PNPM_CONFIG_AUDIT=false` remained the workflow-wide install policy while an
  explicit `pnpm audit --audit-level low` still queried the advisory service
  and reported no known vulnerabilities.
- Shared Node, pnpm, dependency, and Compact setup now precedes the explicit
  audit for every Quality event, while build, typecheck, and static-contract
  work remains scoped by the existing classifier.
- Mandatory verification, full strict integration, Quality-equivalent checks,
  documentation, package-content, policy, harness, and classifier checks were
  exercised without changing release scripts or publishable source.

## Friction and failures

- Renovate's security branch did not update `pnpm-lock.yaml`, which made its
  frozen-install checks fail even though the manifest change was correct.
- The first direct conformance wrapper invocation correctly failed closed
  because tracked implementation changes were not yet committed. Exact-head
  conformance therefore has to run after the signed commit rather than against
  a dirty worktree.
- The pinned dev-loop doctor reported optional subagent support as unavailable;
  the repository-specific harness diagnostic independently passed and the work
  did not require local subagent execution.
- pnpm repeatedly warned that committed project-level credential placeholders
  are intentionally ignored. No credential value was read, logged, or changed.

## Configuration drift and process gaps

- Quality's aggregate check name advertised audit coverage, but the workflow had
  no explicit audit command and skipped dependency setup on maintenance-only
  events. The workflow now makes that security gate visible and event-wide.
- A dependency bot manifest-only update is not sufficient evidence when frozen
  lockfile policy is required; replacement work must regenerate and validate
  the lockfile with the repository's pinned pnpm.
- Install-time audit suppression and an explicit audit gate serve different
  purposes and must remain independently visible in workflow review.

## Decisions

- Pin the direct development dependency exactly to `js-yaml` 4.3.2 and raise
  the existing transitive override floor to `^4.3.2`.
- Reuse the exact reviewed `js-yaml@4.3.2` minimum-release-age exclusion and
  security-update rationale from PR #470; leave all other supply-chain policy
  and exact exclusions unchanged.
- Keep setup and the explicit low-threshold audit unconditional across all
  configured Quality events; keep only expensive build/typecheck/static checks
  classifier-conditional.
- Do not modify `scripts/*.mjs`, publish snapshots, or mutate release state.

## Tracked follow-up actions

- This replacement PR tracks exact-head hosted CI, routed review, commit
  verification, and human approval under #443.
- Close PR #470 only after this replacement has a clean frozen install, audit,
  exact-head review evidence, and required hosted checks.
- Keep publication, tags, releases, registry state, and readiness transitions
  under the existing human-only #443 release gates.

## Guardrails

This change does not alter DID behavior, Compact source or managed artifacts,
package versions, publication scripts, workflow credentials, provenance,
action SHA pins, frozen-lockfile installation, exotic-subdependency blocking,
trust-policy no-downgrade, or release/publish authorization.
