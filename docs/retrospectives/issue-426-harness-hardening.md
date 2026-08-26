# Issue #426 harness-hardening retrospective

Date: 2026-08-19
Canonical tracker: [midnightntwrk/midnight-did#426](https://github.com/midnightntwrk/midnight-did/issues/426)
Evidence: completed PR [#424](https://github.com/midnightntwrk/midnight-did/pull/424)

## What prompted the work

PR #424 demonstrated that an external review request could be described as
complete while current-head `agentflow-pr-review` comments still carried
findings. It also required an eight-commit signature-only rewrite after a bad
signature was found below the head, and CI caught a protected API-module branch
threshold that the documented local light gate did not run. Those are concrete
review-outcome, all-commit-integrity, and local/CI-parity failures rather than
advisory style preferences.

## What worked

- Startup fetched first and created a clean issue-owned worktree from
  `origin/develop`; the dirty primary and old PR #424 worktree were never used
  for implementation.
- Issue #426 was enriched with the whole approved scope, AC, DoD, validation,
  non-goals, and upstream boundary before repository implementation.
- Review request and review acceptance were separated. Exact-head dispatch now
  records only `requested`; a source-neutral audit owns current-head outcomes.
- Negative contracts were written for stale/missing/empty/timeout/findings/
  mixed review evidence, unresolved inline threads, issue-comment findings,
  process-group cleanup, and a bad middle commit signature.
- Pinned project-local CLIs and strict configuration loading replaced ambiguous
  package resolution where repository control exists.

## Friction and failures

- Initial parallel planning children concurrently provisioned `.pi/npm` and
  raced the private review extension installation. Serial `nix develop`
  provisioning repaired the ignored cache.
- The user-defined refiner/quality/docs agents produced useful artifacts but
  ended in failed status because their tool allowlists advertised unavailable
  legacy `search`/`execute` names. A later quality writer partially created a
  verifier test but not its implementation, so the parent inspected and
  completed the slice instead of assuming success.
- These failures reinforce that child output/provenance must survive package,
  tool-registration, and serialization failures without transcript polling.
- `dev-loops@0.9.0 doctor` still does not prove that `.devloops` loaded under the
  strict schema. The repository diagnostic now reports this gap and relies on
  an independent pinned-loader check.

## Decisions

- `main` remains GitHub's release/default branch; `develop` is normal feature
  integration; an existing PR always retains its actual base.
- `maxCopilotRounds: 0` disables Copilot only. It is not a clean verdict and
  cannot bypass the mandatory routed Pat current-head audit.
- The local `independent-review` persona is an optional general LLM lens, never
  Pat. Routed Pat evidence is external, deterministic, SHA-bound policy.
- Local Claude/Agy runs are explicit advisory opt-ins. Unavailable, empty, or
  timed-out local output is reported but is not routed approval.
- Retrospective findings remain advisory. A tracked record and explicit ignored
  completion checkpoint prevent direct workflows from silently skipping the
  reflection without turning its findings into a merge gate.

## Validation and review evidence

Focused review, commit-integrity, skill-mirror, diagnostic, schema, and
retrospective contracts pass. The final focused review/harness suites contain
59 tests, including process-group timeout, bad-middle-signature, issue-prefix,
untracked-record, and cross-issue reuse regressions. The pinned 0.9.0 strict
schema and skill mirrors pass.

`nix develop --command pnpm run verify` passed after the nested canonical
worktree exposed duplicate ESLint config discovery from the enclosing primary
checkout; setting the root ESLint config boundary fixed that harness-specific
path leak. The successful gate ran strict light/core, the integration report,
all package coverage, and protected API module thresholds. `./run.sh docs`
also passed validation, VitePress build, and rendered visual checks. Independent
review findings were fixed through repeated clean re-review; the final review
reported no blockers.

The pushed exact head SHA, CI state, routed review state, and any advisory local
review failures are recorded in the PR evidence after push.

## Follow-ups

The four upstream-only gaps are scoped in
[`docs/harness-upstream-follow-ups.md`](../harness-upstream-follow-ups.md):
harness-aware strict doctor, provider-neutral dev-loops backend support,
branch-role schema, and durable pi-subagents output after workflow
serialization/tool failure. No ignored dependency is edited or vendored here.
