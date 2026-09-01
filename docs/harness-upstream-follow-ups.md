# Harness upstream follow-ups

Issue [#426](https://github.com/midnightntwrk/midnight-did/issues/426) owns the
repository hardening. The items below require upstream contracts and are not
implemented by editing or vendoring ignored dependencies in this repository.

## 1. Harness-aware strict doctor

**Upstream:** `dev-loops`.

`dev-loops@0.9.0 doctor` does not independently fail on `.devloops` schema
fallback and can therefore look healthy while repository policy was not loaded.
Add a strict/harness-aware doctor mode that reports the config file and package
version used, treats parse/schema fallback as failure, validates the active
project root/worktree, and emits machine-readable results. Acceptance: an
invalid repository config makes doctor exit nonzero with the rejected path and
schema issues. Until then, `scripts/harness/diagnose.mjs` runs the pinned strict
loader and reports the upstream doctor limitation separately.

## 2. Provider-neutral dev-loops review backends

**Upstream:** `dev-loops` and review-provider adapters.

Add a backend contract that distinguishes `requested` from current-head
`completed`, carries full head SHA, status, verdict, findings, artifact, timeout,
and provider identity, and can combine formal reviews, inline threads, and
structured issue comments. Acceptance: stale, missing, empty, timeout, findings,
or mixed mandatory backend results cannot become a clean gate. The local
`scripts/review/audit-pr-feedback.mjs` is a repository boundary, not a vendored
replacement for that general adapter.

## 3. Branch-role schema

**Upstream:** `dev-loops` configuration.

Add schema-native roles for GitHub default/release branch, normal feature
integration branch, release-promotion direction, and actual-base preservation
for existing PRs. Acceptance: worktree creation and PR creation can resolve
`develop` for normal features while retaining `main` as release/default, and
never retarget an existing PR by assumption. In 0.9.0 these rules remain in
`AGENT.md` because adding unsupported `.devloops` keys would invalidate policy.

## 4. Pi agent compatibility and concurrent package provisioning

**Upstream:** `dev-loops`, `pi-subagents`, and Pi's package manager.

Pi-subagents 0.62.0 addresses the earlier serialization-recovery gap by
retaining typed errors, partial output, transcript metadata, artifacts, and
completed-child references during foreground resume and workflow
validation/return-serialization failures. Two integration gaps remain:

- `dev-loops@0.9.0` agent definitions advertise Claude-style `search`,
  `execute`, `agent`, and `todo` tools that the pinned Pi runtime does not
  register. The package agents must publish Pi-valid allowlists without losing
  their intended read/write or nested-delegation boundaries.
- Concurrent Pi processes can still race project-local package provisioning in
  the same `.pi/npm` tree. Installation must be serialized or made atomic before
  child startup.

Acceptance: every packaged dev-loop agent passes Pi tool preflight, and
concurrent startup either observes one completed installation or waits for it;
neither path loses child status, output, artifacts, run identity, or recovery
instructions.
