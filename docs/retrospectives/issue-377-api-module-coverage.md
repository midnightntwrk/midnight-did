# Issue #377 API module coverage retrospective

Date: 2026-08-28
Canonical tracker: [midnightntwrk/midnight-did#377](https://github.com/midnightntwrk/midnight-did/issues/377)

## What worked

- Measuring the provider-independent V8 artifact after semantic tests made the
  three new floors evidence-based without encoding their old aggregate-only
  baselines.
- Import-boundary mocks isolated wallet startup, restoration, facade wiring, and
  failure short-circuits without network services or wallet SDK changes.
- Executing every verification-method authorization callback exposed exact DID
  id/version, physical method id, mutation, and payload assertions while keeping
  production closures private.
- Adding checker contract tests to `coverage:all` made fail-closed policy behavior
  a mandatory local and CI signal rather than an optional script test.

## Friction and decisions

- The installed Nix wrapper exported a read-only `COMPACT_DIRECTORY` for
  toolchain 0.30.0 even though the repository requires 0.31.1. The first API
  coverage run therefore encountered generated code expecting Compact runtime
  0.15.0. Pointing `COMPACT_DIRECTORY` at the already provisioned user toolchain
  selected 0.31.1; all focused and full gates then passed without tracked
  generated changes.
- Verification-method coverage measured 100% statements, 94.44% branches, and
  100% functions. The branch floor is 90% rather than the incidental measured
  percentage; wallet context and facade have 100% floors for all three metrics.
- Subagent fan-out was unavailable in the dedicated worktree, so planning and
  review used the documented sequential fallback. The resulting scope stayed
  test, coverage policy, and documentation only.

## Residual evidence and follow-up

Real wallet SDK serialization, worker lifecycle, indexer reconnection, and
funding remain integration evidence. Real contract proof generation and
transaction finality also remain integration evidence. Wallet dependency
upgrades stay explicitly owned by
[midnightntwrk/midnight-did#441](https://github.com/midnightntwrk/midnight-did/issues/441),
not this coverage-only phase.

Hosted CI and routed exact-head review remain external gates. The implementation
agent leaves the PR draft and performs no merge or auto-merge.
