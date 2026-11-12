# Issue #520 Ledger9/SDK5 migration retrospective

Date: 2026-11-12
Canonical tracker: [midnightntwrk/midnight-did#520](https://github.com/midnightntwrk/midnight-did/issues/520)

## What prompted the work

Midnight DID needed to move from Ledger8/Compact 0.31 to the Ledger9/Compact
0.36 runtime cohort. The maintainers approved a Ledger9-only public API and
replacement deployment for hypothetical Ledger8 DIDs, rather than a dual-era
runtime or automatic on-chain migration.

## What worked

- Pinning the coordinated Compact, compact-runtime, Midnight JS, wallet SDK,
  ledger, node, indexer, and proof-server cohort first made later failures
  attributable to API or topology behavior instead of floating versions.
- A real disposable undeployed topology exposed wallet/Dust and indexer issues
  that unit tests could not: initial Dust readiness, SPO startup ordering, and
  proof-server health probing.
- Real integration tests exercise controller recovery, stale-version rejection,
  and wallet snapshot continuation. Unit tests separately retain private-state
  persistence, receipt-loss retention, concurrency, and redaction guarantees.
- Indexed-block-time Dust readiness replaced a wall-clock assumption, and the
  required readiness argument made the breaking API explicit for 1.0.
- Clean file-tarball consumers and an SDK5 ZK provider check caught packaging
  gaps that workspace-linked smoke tests could not.

## Friction, failures, and drift

- The first topology disappeared mid-suite. Idle-control evidence traced it to
  the indexer SPO client rather than cumulative DID operations or OOM.
- Pointing SPO at the Midnight node exposed a fresh-genesis race: the indexer
  requested block 1 before the node produced it. Node readiness now waits for
  block 1 before starting the dependent indexer.
- The original proof-server healthcheck used curl, which the selected proof
  image does not contain. A native Bash `/dev/tcp` HTTP status probe replaced
  the invalid curl-based healthcheck.
- Early ZK bundles omitted the compiler manifest required by SDK5 integrity
  verification; the bundle and archive smoke server now include it.
- Historical published-compatibility wording and current setup instructions
  drifted from the selected 0.36/9 cohort. They were corrected without
  rewriting historical baselines.
- An early full strict run preceded final docs/conformance/packaging-only
  repairs. Targeted verify and consumer/archive checks then covered those
  changes while the production API remained unchanged; a fresh full strict run
  is required before the implementation commit.

## Follow-up actions

- #244 remains the separate owner for CMA verifier-key maintenance and custody;
  this migration does not add that feature.
- [#754](https://github.com/midnightntwrk/midnight-verifiable-credentials/issues/754) remains the cross-repository companion VC integration path. The local candidate package
  and ZK handoff is identified, but the sibling VC checkout is absent, so VC
  reference/runtime validation is not claimed.
- Keep the candidate unpublished until maintainer review and the separate
  release/publication process authorize otherwise.

## PR #521 review-repair follow-up

- **What worked:** Independent bounded review and failing-before/passing-after
  regressions exercised the exported public archive helper, actual SDK5 injected
  fetch caller, and shared readiness budget across delayed initial wallet state.
- **Failures and drift:** The public archive consumer rejected the exact compiler
  metadata pair; injected fetch retained the old constructor shape instead of
  SDK5's `options.fetchFunc`; registration restarted its readiness deadline;
  current deployment/network guidance still described SDK4 behavior.
- **Process gap:** Prior green script-checker, HTTP and workspace fixture evidence
  did not exercise the public unpacker or injected-fetch boundary. Those results
  were not proof of compatibility at the omitted consumer boundaries.
- **Preserved boundaries:** Configuration, dependency cohort and repository policy
  are unchanged. Repairs retain default artifact integrity and the existing
  sequential transaction/custody behavior; readiness tests do not establish an
  end-to-end transaction cancellation guarantee.
- **Tracked follow-up:** Retain the public-helper/compiler-metadata negatives,
  real-SDK injected/HTTP integrity regressions and delayed-state shared-budget
  regressions in the owning issue #520 test lanes. Companion VC integration
  remains tracked by the existing #754 follow-up above.

At this checkpoint, targeted **working-tree** validation passed 329 API tests
and 83 bundle/smoke tests. Full verify/strict, actual production bundle/package
and clean-consumer checks, docs validation and current-CI validation are still
pending. These results are not new-head or final delivery acceptance evidence.
