# Develop PR Transition Notes

Last updated: 2026-05-15

Target branch: `origin/develop`.

## Current Replacement PR

PR: `#91` (`codex/did-runner-metrics-develop`)

Purpose:

- replace the stale `main`-targeted DID PR stack with one reviewable
  `develop`-targeted runner-stability slice
- keep the root runner scoped to the DID workspace only
- make runner behavior observable through a stable CLI contract

Scope:

- shared runner flag parsing in `scripts/run-common.sh`
- `--light`, `--strict`, `--skip-coverage`, `--metrics`, and
  `--metrics-json <file>` support
- per-step duration output for local bottleneck triage
- partial metrics JSON even when a step fails, so CI failures preserve the
  last completed step and failing step context
- contract tests for the runner CLI and generated metrics shape

Validation:

- `bash -n run.sh scripts/run-common.sh`
- `npm run test:run-sh`
- dry-run metrics JSON probes
- failed-step metrics probe
- `git diff --check`

Merge gates:

- target branch is `develop`, not `main`
- DCO and GPG signing are required on commits
- Claude PR review must have no critical open findings
- GitHub Actions CI must be green before merge

## Superseded PRs

The stale DID PRs targeting the wrong branch were closed and should not be
merged as-is:

- `#79` through `#90`

If any old slice is still useful, recreate it as a fresh `develop`-targeted PR
with current branch context rather than retargeting the stale stack.

## Follow-Up Candidates

Re-evaluate these only after `#91` lands on `develop`:

- runtime provider utility hardening
- resolver input normalization and guardrails
- persisted state schema sentinels
- DID circuit registry documentation
- ledger/runtime compatibility notes for the current Compact toolchain
