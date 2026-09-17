# Issue #486 publisher fixture timeout retrospective

Date: 2026-09-17
Canonical tracker: [midnightntwrk/midnight-did#486](https://github.com/midnightntwrk/midnight-did/issues/486)
Fixing change and current revision: [PR #487](https://github.com/midnightntwrk/midnight-did/pull/487)
Scenario origin: [PR #479](https://github.com/midnightntwrk/midnight-did/pull/479)

## What worked

PR #479 kept production publication controls explicit and independently testable: npm reads are bounded to 30 seconds, publishes to 300 seconds, provider output to 65,536 bytes, tarball connections to 10 seconds, tarball transfers to 120 seconds, tarballs to 104,857,600 bytes, and post-publish convergence to exactly 300 seconds. Its deterministic fake `date` and `sleep` commands exercise the convergence boundary without waiting in real time or touching npmjs.

The issue #486 fix remains entirely in the test harness. A clearly named 60-second subprocess allowance now covers one complete mocked five-package publisher invocation. A regression test distinguishes that wall-clock allowance from the unchanged production read, publish, output, tarball, and convergence constants. No publisher script, workflow, package, registry state, or release behavior changed.

## What failed and why

The fixture runner retained its original anonymous 15-second `spawnSync` timeout after PR #479 added several full five-package convergence scenarios. On a loaded runner, valid subprocess work could exceed that harness wall-clock budget even though fake convergence time advanced instantly and every production command remained within its own bound. `spawnSync` then returned `status: null`, making deterministic scenarios race machine load rather than publisher behavior.

The gap was test-envelope maintenance: scenario complexity increased, but the enclosing fixture-process allowance was neither named nor asserted separately from production limits. The failure did not indicate a real convergence sleep, production timeout, or unsafe publication retry.

## Configuration drift and process gaps

No production configuration drift was found. The publisher constants and 300-second convergence deadline still match the release guidance introduced by PR #479. The process gap was that review and validation concentrated on production bounds while the harness-only outer timeout remained an unexplained literal. Naming and directly asserting both sides of that boundary makes future drift visible.

## Validation and safety boundary

The publisher fixture scenarios use local fake npm, curl, date, and sleep executables, so those scenarios do not contact npmjs or wait for real registry convergence. The broader validation is not fully offline: `pnpm install --frozen-lockfile` may fetch dependencies when they are absent from the local store, and `pnpm audit` accesses registry audit data; it also uses real local Node and tar tooling. Validation does not dispatch the release workflow or mutate npm packages, access, dist-tags, GHCR, GitHub Releases, or merge state. Repeated publisher tests, Trusted Publishing, repository-policy, release-context, formatting, audit, and the mandatory repository verification gate provide the evidence for this test-only change.

## Tracked follow-up actions

- Issue #486 and its linked draft PR track exact-head CI, signed/DCO commit verification, retrospective completion, and routed review before human merge.
- Preserve the explicit production-limit regression assertions whenever publisher fixture scenarios change; any production timeout or convergence change requires a separate release-behavior issue and review rather than reuse of this harness allowance.
- Keep deterministic fake-clock coverage free of real convergence sleeps; issue #486 remains open until repeated bounded publisher runs demonstrate that the loaded-runner race is resolved.
