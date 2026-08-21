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
- Public rotation/recovery auto-bind or assert the canonical contract address,
  and public reconciliation requires it. API-bound wrappers for one DID share a
  process-local critical section across the full lifecycle. Acquisition is
  fail-fast and the owner retains its reservation until settlement; elapsed time
  cannot release a lease while provider or transaction work may continue.
  Operational timeout handling must cancel that work and then reconcile ledger
  and private state. Provider-object fallback is only for internal/deep unbound
  use. Direct provider mutation, independently unbound wrappers, and separate
  processes require external per-DID coordination because storage has no atomic
  conditional write across processes.
- Explicit non-finalization confirmation permits discard of any non-null pending
  record, including malformed state, so corrupt storage cannot permanently block
  a replacement candidate. Promotion continues to require valid pending state.
  Once manual promotion writes active state, cleanup rejection is warning-only,
  but its disposition is uncertain: the candidate may remain or may already have
  been removed. Later reconciliation processes retained state or returns the
  typed unavailable error if deletion committed.
- `midnight-js-contracts` 4.0.2 binds the target and awaits active-state and
  signing-key persistence after ledger success but before `deployContract`
  returns. A deployment-scoped provider interceptor reserves the canonical
  target before that first mutation, records the observed finalized target, and
  keeps the source/target lease through the dependency's settlement. After the
  active-state and signing-key writes, the interceptor advances to handle
  construction before the dependency's second address bind, without resetting
  on that repeat bind. Rejections after target observation become a strict typed
  shape containing only the canonical address and an interceptor-controlled
  local setup stage alongside stable error identity. Source errors, contract
  handles, provider text, and all
  deployment/transaction/finality evidence are discarded because even nominally
  public or diagnostic objects can retain secrets. Pre-target failures remain
  unchanged.
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
  malformed promotion remain typed and non-mutating. Cleanup rejection after a
  successful active write returns the promoted state with truthful warning and
  coverage for both retained and already-deleted outcomes.
- Realistic 4.0.2 deployment mocks call target binding, active-state persistence,
  and signing-key persistence in upstream order. Regressions cover a target
  owner present before interception, a competitor arriving after reservation,
  active-state and signing-key rejection, second-bind and later handle
  construction rejection after completed persistence, single-write success that
  preserves a concurrently rotated controller key, source/target binding
  tracking, recursive adversarial secret-unreachability, and unchanged pre-target
  `DeployTxFailedError` behavior.
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
- The process-local lock rejects overlap immediately rather than queueing a
  reconciliation whose ledger evidence may be stale. Tests hold an owner
  unresolved while competing rotation, recovery, and discard all receive the
  typed busy error, then prove access resumes only after owner settlement. The
  reviewer-discovered rebind edges also showed that source and target
  reservations must be checked before provider address or lock-key mutation.
  Direct provider mutation and cross-process writers remain outside this API
  exclusion mechanism.
- A malformed non-null candidate is unsafe to promote but safe to remove only
  after the caller explicitly asserts non-finalization. Treating presence and
  recoverability as separate predicates avoids persistent lockout without
  weakening the finalized-candidate safeguard.
- Join must use the same owner-token lease as deployment and pending-controller
  work. Acquiring before binding and holding both source and target reservations
  through private-state loading and contract lookup avoids a window where join
  rebinding can race rotation, recovery, reconciliation, or another rebind.
  Acquisition remains immediate and fail-fast; unresolved provider/transaction
  work is uncancellable, so elapsed-time expiry would reopen the mutation race.
  Safe stale-owner recovery is operation/process cancellation followed by state
  reconciliation, never releasing a lease while its owner may still execute.
- The level private-state provider's unbound error has a precise full message.
  Substring classification accidentally swallowed decorated storage/I/O errors;
  exact matching preserves only the intended pre-binding initialization path.
- A candidate created before authorization preflight is safe to delete only when
  `callTx` was definitely never invoked. Cleanup stays inside the held lease; a
  rejected remove has uncertain retain/delete disposition and therefore needs a
  truthful warning plus explicit discard guidance rather than a success claim.
- Waiting for a target-address lifecycle is not sufficient permission to save
  the deployment input: that lifecycle may have rotated the target controller.
  The 4.0.2 dependency already performs the active-state write before its
  signing-key write and return, so a second post-return save can overwrite such
  a rotation and is unsafe. Recovery must re-read provider and ledger state,
  reconcile with the current owner, and join the already-finalized address. An
  uncertain upstream save must be verified before retry because its write may
  have committed even though it rejected. The source/target reservation remains
  operation-scoped with no elapsed expiry; releasing while dependency work can
  still settle would reopen the same stale-writer race.

## Follow-up actions

- Integrators relying on implicit purge behavior must migrate to explicit
  relationship removals and state-aware retry.
- Reviewers should verify the shared coded-error base, each stable domain code,
  and the controller pending-state recovery guidance against the exact PR head.
- CI must complete the Docker-backed integration lane before approval.
- Extend provider/DID identity assertions to ordinary non-rotation document
  operations in a follow-up rather than widening this explicit-deletion change.
- Integrators must catch finalized-deployment private-state setup errors, retain
  deployment private state outside the error, use its canonical address and
  controlled stage to resolve target ownership, re-read ledger/storage state,
  and reconcile or join rather than issuing another deployment. Source/provider
  diagnostics belong in separately access-controlled external logs and must
  never be attached to or logged through the typed error.
