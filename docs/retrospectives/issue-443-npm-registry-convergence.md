# Issue #443 npm registry convergence recovery retrospective

Date: 2026-09-16
Canonical tracker: [midnightntwrk/midnight-did#443](https://github.com/midnightntwrk/midnight-did/issues/443)

## Incident evidence

Manual Trusted Publishing [run 35114111966](https://github.com/midnightntwrk/midnight-did/actions/runs/35114111966) ran from `develop` at `e904e91abd877cc311f7abf9b57184920c8d723c`. `npm publish` returned success for `@midnight-ntwrk/midnight-did-jubjub-schnorr@0.6.0-rc1`, but the immediate exact-version read-back returned absent and the publisher failed with `Expected ... during immutable payload verification.`

npmjs exposed the version at `2026-09-16T15:24:55Z`, approximately 2.5 minutes after the successful publish step. Subsequent public evidence showed the expected immutable integrity, provenance, and `rc` dist-tag while `latest` remained unchanged. At recovery planning time Jubjub `0.6.0-rc1` existed and the contract, domain, DID, and API `0.6.0-rc1` versions were absent. This was registry read-after-write lag, not evidence that retrying `npm publish` was safe.

## Recovery change

The publisher now gives only post-successful-publish registry evidence a bounded convergence window: up to 300 seconds, polled every 30 seconds. Each poll reads the exact version, verifies its immutable payload against the prepacked artifact, and then reads the requested tag. The next dependency cannot publish until both payload and tag match. `npm publish` remains a single call site and is never retried.

Confirmed payload mismatches, malformed metadata or tags, non-`latest` releases unexpectedly owning `latest`, command failures other than a recognized exact-version 404, and unsafe downloads still fail immediately with provider output suppressed. A valid but not-yet-updated requested tag is retried because it is indistinguishable from observed propagation lag; expiry fails closed. Preflight behavior for versions that existed before the run is unchanged: payload and requested tag must already match or the run stops before mutation.

The `npm-release` job timeout is 75 minutes. This accommodates five independent five-minute convergence gates plus existing bounded publish/read commands and the final all-five read-back without weakening any command-level limit.

## Exact same-rc1 recovery procedure

After this fix is reviewed and merged to `develop`, the release owner may request the protected `npm-release` approval and manually dispatch `publish.yml` from the exact `develop` branch with:

- `channel`: `rc`
- `version`: `0.6.0`
- `rc_index`: `1`

Before approval, confirm the merged revision changes no product package contents relative to the failed run's packed artifacts. The rebuilt Jubjub tarball must therefore match the public immutable package identity. The read-only all-five preflight will verify public Jubjub payload plus `rc=0.6.0-rc1`, confirm `latest` is not `0.6.0-rc1`, skip Jubjub without publishing it, and publish only the four absent packages in catalog dependency order. Each successful publish must converge and verify before the next one. The final all-five read-back must pass before non-npm release jobs can proceed.

Do not rerun the failed job, dispatch from another ref, change inputs, create `rc2`, call `npm access` or `npm dist-tag`, republish Jubjub, or attempt tag repair. Any mismatch or malformed/unsafe evidence requires stopping for separate investigation; the normal Trusted Publishing path has no npm-administration authority.

## Tests and validation

Deterministic fake npm/date/sleep fixtures cover delayed exact-version visibility, delayed requested-tag visibility, acceptance at exactly 300 seconds, fail-closed evidence after 300 seconds, deadline expiry, immediate immutable mismatch and malformed-metadata failure, Jubjub-present/four-absent recovery in dependency order, and absence of duplicate publishes. They also prove that mismatched pre-existing versions receive no convergence sleeps. Mocked time advances without real sleeps. Existing adversarial coverage continues to enforce isolated token-free npm environments, suppressed provider output, one bounded publish call site, no access/tag administration, all-three-channel idempotence, final read-back, command bounds, and partial/lost-response recovery.

The recovery change passed `pnpm install --frozen-lockfile`, a zero-vulnerability `pnpm audit --audit-level=high`, the focused publisher/Trusted Publishing/repository-policy/release-context suites, formatting and shell syntax checks, `pnpm run verify`, and `PROOF_SERVER_IMAGE=proof-server-bootstrap:8.0.3 ./run.sh --strict`. Validation performs no workflow dispatch and no npm, tag, access, GHCR, GitHub Release, or merge mutation.

## What worked, gap, and follow-up

The existing fail-closed ordering prevented the four dependent packages from publishing after unverifiable evidence, and immutable preflight recovery made the partial state recoverable without npm administration. Provider output suppression also kept an operational inconsistency from widening the trust boundary.

The gap was treating a successful publish followed by an immediate recognized 404 as a definitive absence. The fix remains deliberately narrow rather than introducing generic retries: only valid post-write visibility/tag convergence is tolerated, for a fixed deadline, while writes and unsafe evidence remain fail-closed.

Release engineering must observe the authorized same-rc1 recovery run and attach its exact run/SHA and five-package final evidence to issue #443. Any future increase to the convergence deadline must be justified by recorded registry timing and reviewed together with the job timeout.
