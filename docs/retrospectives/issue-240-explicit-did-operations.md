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
  finalized transaction data was not returned. A typed error prevents blind or
  overlapping attempts from replacing that candidate; callers reconcile the
  on-ledger controller public key, then explicitly promote or discard the slot.
- The provider interface has no compare-and-set primitive. A process-local
  critical section spans the full pending-controller lifecycle, beginning before
  active/recovery-state and ledger preflight, and uses the canonical contract
  address recorded by `bindPrivateStateProvider`, so bound wrappers for one DID
  exclude one another. Binding and join fail closed before mutating either a
  provider whose current key is reserved or a provider into a reserved target
  key. Direct `setContractAddress` calls bypass this coordination and are
  prohibited during the lifecycle. Explicitly unbound wrappers fall back to
  provider identity; separate processes and independently unbound wrappers must
  lock externally per DID private-state store.
- Explicit non-finalization confirmation permits discard of any non-null pending
  record, including malformed state, so corrupt storage cannot permanently block
  a replacement candidate. Promotion continues to require valid pending state.
  Once manual promotion writes active state, cleanup failure is warning-only and
  retains the candidate for an idempotent reconciliation retry.
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
  Additional persistent-state, deferred reconciliation-race, and two-wrapper
  regressions prove candidate A remains stored, active state is not promoted,
  and no competing call removes or replaces it. A reviewer then found that a
  mutable address-scoped wrapper could be rebound from DID A to DID B while A's
  lock was held, redirecting promotion and cleanup despite that coverage. A
  deterministic deferred-call regression now attempts same-wrapper A-to-B,
  same-address, and distinct-wrapper target-key binds; each returns the typed
  busy error without changing either DID namespace, and the ambiguous operation
  retains candidate A under DID A. Fresh deferred active-state and ledger
  preflight regressions then exposed and closed an earlier gap: the address
  reservation is now held before either provider-dependent preflight, and every
  failure path releases it.
- Malformed/absent reconciliation regressions distinguish presence from validity:
  confirmed discard removes malformed records, absent discard and missing or
  malformed promotion remain typed and non-mutating, and cleanup failure after a
  successful active write returns the promoted state with exact warning and
  idempotent-retry coverage.
- `pnpm run verify`, managed-artifact checks, package-surface checks, and the
  complete docs build/visual lane passed from the Nix development shell.

## Friction and limitations

- The first recovered worktree lacked workspace dependencies and generated
  Compact outputs. A frozen pnpm install followed by `build:api-prereqs`
  restored the expected isolated-worktree baseline.
- One full-run harness attempt hit the existing one-second review-test timing
  boundary while the machine was loaded; the focused 32-test suite passed on
  immediate rerun.
- The initial local API integration attempt used the available
  `midnightntwrk/proof-server:8.0.3` image after the preferred bootstrapped image
  was unavailable, but the proof server did not expose `/version` within the
  180-second health timeout. During exact-head review follow-up, the same
  Docker-backed integration lane completed all 27 tests, including explicit
  relationship deletion and controller rotation.
- The process-local lock deliberately rejects overlap with a typed busy error
  rather than queueing a reconciliation whose ledger evidence may be stale. The
  reviewer-discovered rebind edges showed that both lock-key immutability and
  acquisition before provider-dependent preflight are part of that exclusion:
  source and target reservations are checked synchronously before
  `setContractAddress` or the wrapper-to-key mapping changes. It remains an
  in-process API exclusion mechanism, not protection against direct provider
  mutation and not a cross-process compare-and-set claim.
- A malformed non-null candidate is unsafe to promote but safe to remove only
  after the caller explicitly asserts non-finalization. Treating presence and
  recoverability as separate predicates avoids persistent lockout without
  weakening the finalized-candidate safeguard.

## Follow-up actions

- Integrators relying on implicit purge behavior must migrate to explicit
  relationship removals and state-aware retry.
- Reviewers should verify the shared coded-error base, each stable domain code,
  and the controller pending-state recovery guidance against the exact PR head.
- CI must complete the Docker-backed integration lane before approval.
