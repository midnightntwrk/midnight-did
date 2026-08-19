# Issue #240 explicit DID-operation retrospective

Date: 2026-08-20
Canonical tracker: [midnightntwrk/midnight-did#240](https://github.com/midnightntwrk/midnight-did/issues/240)

## What prompted the work

The SDK presented verification-method removal as one logical helper while it
actually submitted several independently finalized relationship removals before
the method-removal transaction. A partial failure could leave visible,
partially updated DID state. Controller rotation and recovery also cleared the
only persisted replacement secret when a transaction call threw, even though a
receipt/finality-stream failure can happen after the ledger transition succeeds.

## Decisions

- Applications now own explicit relationship-removal ordering. Each
  `removeVerificationMethodRelation` call and the final method removal is one
  operation and one independently finalized transaction.
- Both method-removal helpers preflight all five relationship sets and throw the
  exported `VerificationMethodReferencedError` before authorization or
  submission. The existing Compact guard remains authoritative for direct
  callers, stale reads, and races.
- Missing relationship removal remains an error rather than becoming an
  idempotent no-op. Retry logic must re-read state and skip work already visible
  on-ledger.
- Controller rotation and recovery retain pending replacement state whenever
  finalized transaction data was not returned. Callers reconcile the on-ledger
  controller public key before retrying or promoting the pending secret.
- The specification distinguishes the method's no-batch-circuit design from
  Midnight's inability to merge multiple non-empty contract-call sections.

## What worked

- The existing Compact deletion invariant required no contract-source or ledger
  schema change; focused simulator coverage could pin all reachable relation
  cases for both verification-method stores.
- API unit tests made the single-submission boundary observable: referenced
  removals neither authorize nor submit, and successful removals do not submit
  relationship mutations.
- Receipt-loss tests simulate the ledger key changing immediately before the
  client call throws, which exercises the exact destructive window from #240.
- `pnpm run verify`, managed-artifact checks, package-surface checks, and the
  complete docs build/visual lane passed from the Nix development shell.

## Friction and limitations

- The first recovered worktree lacked workspace dependencies and generated
  Compact outputs. A frozen pnpm install followed by `build:api-prereqs`
  restored the expected isolated-worktree baseline.
- One full-run harness attempt hit the existing one-second review-test timing
  boundary while the machine was loaded; the focused 32-test suite passed on
  immediate rerun.
- The local API integration attempt used the available
  `midnightntwrk/proof-server:8.0.3` image after the preferred bootstrapped image
  was unavailable, but the proof server did not expose `/version` within the
  180-second health timeout. Unit, Compact simulator, and CI-parity validation
  passed; current-head CI remains the authoritative integration environment.

## Follow-up actions

- Integrators relying on implicit purge behavior must migrate to explicit
  relationship removals and state-aware retry.
- Reviewers should verify the typed error's stable public shape and the
  controller pending-state recovery guidance against the exact PR head.
- CI must complete the Docker-backed integration lane before approval.
