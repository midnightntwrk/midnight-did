# Issue #481 full gate-helper diagnostic retrospective

Date: 2026-09-17
Canonical tracker: [midnightntwrk/midnight-did#481](https://github.com/midnightntwrk/midnight-did/issues/481)

## Evidence and impact

The post-`0.6.0-rc1` review found that PRs #479 and #480 posted checkpoint verdicts through the packaged `post-gate-verdict-fallback.mjs` path even though the full helper was installed at `.pi/npm/node_modules/dev-loops/scripts/github/upsert-checkpoint-verdict.mjs`. The fallback comments were visible, but they did not perform the full helper's stale-head, gate-coordination, blocking-severity, or internal-only-PR checks. A missing repository-root helper path had been mistaken for a missing installed helper.

Release and product behavior were not affected. The gap weakened local gate evidence and made the degraded path insufficiently visible to operators.

## What worked

The project-local Pi package pins were exact, and the full `dev-loops@0.9.0` helper was already present. Existing package-version checks, strict schema loading, and the repository's fail-closed review policy provided the right boundaries for a repository-owned diagnostic fix. No ignored package content needed to change.

## What failed and configuration drift

`scripts/harness/diagnose.mjs` originally checked the package version and upstream doctor but did not resolve the full gate helper inside that verified package. The first correction resolved the helper, syntax-checked it, and ran `--help`, but exact-head review found that this still proved only loadability. The helper's real gate-coordination path invokes `gh pr view` with `closingIssuesReferences`; the locally installed `gh 2.67.0` rejects that field. The diagnostic therefore reported ready while the first real invocation would fail. It also treated `fallback-only` as a warning, allowing the top-level result to remain ready even though fallback comments are degraded evidence.

Guidance described the generic fallback rule without naming the authoritative project-local invocation or its runtime dependency. Package installation and repository guidance were consistent on version but incomplete on runtime capability, allowing fallback evidence to appear interchangeable with full exact-head evidence.

## Resolution and deferred migration

The diagnostic now resolves the bounded project-local package path, validates package identity and version, syntax-checks the full helper, probes its CLI help contract, and runs a bounded non-mutating `gh pr view` capability probe against the helper's actual required field list. Provider output is captured within fixed limits and is not copied into diagnostic details. Unsupported fields, unavailable/auth-failed current-PR reads, timeouts, and invalid responses classify as `fallback-only`; package metadata/version failures remain `package-failure`. Every status except `full-helper-ready` is an error in top-level aggregation, so degraded fallback evidence can never produce `ok: true`.

Deterministic temporary fixtures inject the runtime-probe outcome and cover ready, unsupported, unavailable, missing, malformed, invalid CLI, and version-mismatch states without modifying `.pi/npm` or depending on live provider behavior.

Development guidance now names the package-local helper and records the fallback's degraded evidence boundary. Upgrading `dev-loops`, Pi, pi-subagents, or agent-review remains deferred: changing reviewed harness pins during the 0.6 release train would add unrelated migration risk, and the installed version already contains the required full helper.

## Follow-up actions

Issue #481 tracks this repository diagnostic and guidance correction. Issue #426 remains the tracked upstream follow-up for a harness-aware strict doctor and related dev-loop integration gaps. A future `gh` or `dev-loops` pin change should restore full-helper readiness only after the same runtime probe succeeds; this PR intentionally does not hide the current `gh 2.67.0` mismatch by changing reviewed tooling pins. Future release-gate runs must inspect the package-local helper first and must explicitly report fallback-only evidence as a failed readiness check rather than full gate completion.
