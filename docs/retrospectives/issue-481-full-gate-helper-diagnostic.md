# Issue #481 full gate-helper diagnostic retrospective

Date: 2026-09-17
Canonical tracker: [midnightntwrk/midnight-did#481](https://github.com/midnightntwrk/midnight-did/issues/481)

## Evidence and impact

The post-`0.6.0-rc1` review found that PRs #479 and #480 posted checkpoint verdicts through the packaged `post-gate-verdict-fallback.mjs` path even though the full helper was installed at `.pi/npm/node_modules/dev-loops/scripts/github/upsert-checkpoint-verdict.mjs`. The fallback comments were visible, but they did not perform the full helper's stale-head, gate-coordination, blocking-severity, or internal-only-PR checks. A missing repository-root helper path had been mistaken for a missing installed helper.

Release and product behavior were not affected. The gap weakened local gate evidence and made the degraded path insufficiently visible to operators.

## What worked

The project-local Pi package pins were exact, and the full `dev-loops@0.9.0` helper was already present. Existing package-version checks, strict schema loading, and the repository's fail-closed review policy provided the right boundaries for a repository-owned diagnostic fix. No ignored package content needed to change.

## What failed and configuration drift

`scripts/harness/diagnose.mjs` checked the package version and upstream doctor but did not resolve the full gate helper inside that verified package. Guidance described the generic fallback rule without naming the authoritative project-local invocation. The package installation and repository guidance were therefore consistent on version but incomplete on runtime helper resolution, allowing fallback evidence to appear interchangeable with full exact-head evidence.

## Resolution and deferred migration

The diagnostic now resolves the bounded project-local package path, validates package identity and version, syntax-checks the full helper, and probes its CLI help contract. It distinguishes `full-helper-ready`, `fallback-only`, and `package-failure` without reading or reporting credentials. Deterministic temporary fixtures cover ready, missing, malformed, invalid CLI, and version-mismatch states without modifying `.pi/npm`.

Development guidance now names the package-local helper and records the fallback's degraded evidence boundary. Upgrading `dev-loops`, Pi, pi-subagents, or agent-review remains deferred: changing reviewed harness pins during the 0.6 release train would add unrelated migration risk, and the installed version already contains the required full helper.

## Follow-up actions

Issue #481 tracks this repository diagnostic and guidance correction. Issue #426 remains the tracked upstream follow-up for a harness-aware strict doctor and related dev-loop integration gaps. Future release-gate runs must inspect the package-local helper first and must explicitly report any fallback-only evidence rather than treating it as full gate completion.
