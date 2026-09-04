# Issue #463 release-output injection retrospective

Date: 2026-09-04
Canonical tracker: [midnightntwrk/midnight-did#463](https://github.com/midnightntwrk/midnight-did/issues/463)
Release base: `origin/main@218ec2f44848fd5f1977c653b134441ce647703f`

## What worked

The implementation started from the exact fetched `origin/main` release head in
a dedicated worktree and did not import `develop`. The existing resolver was
reproduced without dispatching a workflow by running the `origin/main` script
with a temporary `GITHUB_OUTPUT`. It exited zero and produced a separate
`injected_key=injected_value` record from a newline-bearing manual version.

Regression tests were added before the implementation. The first focused run
had 25 failures out of 50 tests: stable-SemVer, whitespace, control-character,
LF/CR/LF injection, unsupported-event, and missing privileged-boundary
validation cases all exposed the old behavior. After the shared release-context
policy and safe output writer were introduced, all 50 initial resolver and
boundary cases passed. The completed focused matrix now has 132 passing cases,
including representative ASCII and Unicode whitespace, every
process-representable C0/C1 control character, exact branch refs, and branch ref
types. NUL handling is represented
honestly: Node and the operating system reject NUL in a process environment
before Bash starts, so the test covers that process boundary rather than
claiming a shell variable carried NUL.

One release-context validator now owns event, exact full branch ref, ref type,
channel, stable base, RC-index, and resolved-version relationships. The initial
resolver sources it, and credential-bearing signing, npm, GHCR, provenance
handoff, and GitHub Release paths re-run it against GitHub's immutable default
context variables. A dispatch from a tag named `main` or `develop` fails before
outputs or privileged commands. Existing package order, provenance commands,
artifact names, and publication scripts were not changed.

## Failures and friction

A first grouped Nix invocation used a login shell, which reset the Nix `PATH` to
macOS Bash 3.2. That produced false `mapfile` failures in the existing publisher
tests and exposed one real portability issue in the new validator: Bash 3.2 does
not support `${value,,}` lowercase expansion. The validator now uses `tr`, and
the direct non-login Nix rerun used Bash 5.3 and passed all 132 resolver/boundary
cases and all 36 mocked publisher cases. The upstream dev-loops doctor still
reports its known subagent-discovery warning; the repository harness diagnostic
otherwise confirms the dedicated worktree, pinned package versions,
configuration, and review readiness once the planned source changes are
committed.

The mandatory `pnpm run verify` gate passed. The documented full strict runner
also passed with `PROOF_SERVER_IMAGE=proof-server-bootstrap:8.0.3`, including all
27 long-running API integration cases. Test infrastructure and generated build,
coverage, docs, and runtime artifacts were cleaned afterward.

The installed `edit-issue.mjs` wrapper does not expose label mutation, and no
installed label-list wrapper exists. The authorized `status:blocked` to
`status:in-progress` transition therefore used the authenticated GitHub CLI
directly, then the canonical `loop info --issue 463 --json` read verified the
result. This is a dev-loop tooling gap, not a release-code exception.

## Process gaps

The workflow previously treated manual `version` as optional and validated its
SemVer shape only later in version preparation, after the untrusted value had
already been serialized into `GITHUB_OUTPUT`. Repository policy also asserted
npm token isolation but did not assert that release context was revalidated in
the same step as each privileged publication command. The new resolver and
workflow-policy tests make both regressions visible.

Reusable GitHub Actions jobs cannot run a caller-owned shell step inside the
called workflow. The SLSA provenance boundary therefore uses a dedicated,
read-only validation dependency immediately before the reusable job, while each
credential-bearing shell publication/finalization command validates in its own
step.

## Tracked follow-up actions

- Issue #463 remains the exact-head security/release review and merge tracker;
  no publication or workflow dispatch is permitted from this implementation
  phase.
- Because this blocker is fixed directly from `main`, synchronize the reviewed
  fix back to `develop` before any further `develop` snapshot or RC if those
  channels remain enabled. Do not substitute an unreviewed `develop` variant.
- Issue #443 remains the 0.6 release-readiness NO-GO tracker until the post-fix
  SHA, independent npm authentication evidence, and explicit human publication
  approval are recorded.
- Extend the supported dev-loop issue-edit wrapper with label add/remove and add
  a bounded label-list wrapper so future label transitions do not need a raw
  GitHub CLI fallback.

## Residual risk

Repeated local validation protects the workflow definition against stale or
injected context, but branch protection and exact-head review remain necessary
to protect the workflow file and validator themselves. GitHub-provided event,
full ref, ref type, run number, and SHA are treated as trusted context inputs; a compromise
of the Actions control plane is outside this repository-level boundary. No test
in this phase proves registry authorization or publication success because no
credential-bearing or mutating release operation was run.
