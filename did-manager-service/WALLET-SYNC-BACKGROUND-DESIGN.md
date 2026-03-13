# Wallet Sync Background Design

## Context

The current `did-manager-service` session bootstrap path is synchronous:

1. `/api/session/unlock` calls `DidManagerService.unlock()`.
2. `unlock()` calls `api.buildWalletAndWaitForFunds(config, seed)`.
3. `buildWalletAndWaitForFunds()`:
   - derives the wallet from the shared seed,
   - starts the wallet,
   - waits for wallet sync,
   - waits for positive funds,
   - only then returns.

Relevant code:

- [did-manager-service/src/manager.ts](./src/manager.ts)
- [api/src/lib.ts](../api/src/lib.ts)

This is why the UI appears blocked during preprod wallet initialization and funding. The HTTP request stays open for a long time, and the manager cannot give the UI structured progress beyond log lines such as:

```text
Waiting for wallet sync...
```

## Problem Statement

The app currently treats these distinct concerns as one blocking operation:

- seed resolution and persistence,
- wallet process startup,
- wallet synchronization,
- funding readiness,
- unlocked session readiness.

That design is acceptable for tests and simple local flows, but it is the wrong model for real user interaction, especially on `preprod`.

### Current UX issues

- `unlock` can take a long time and gives no structured progress to the UI.
- The frontend cannot distinguish:
  - wallet is starting,
  - wallet is syncing,
  - wallet is synced but unfunded,
  - wallet is ready.
- The API contract is request/response shaped, while the underlying workflow is long-running and stateful.
- Recovery is weak. If startup fails mid-flight, the user only gets a terminal error, not a resumable session state.

### Architectural issue

`did-manager-service` currently couples:

- long-running wallet initialization,
- session state mutation,
- DID manager readiness.

This should be split into:

- persistent session state,
- background wallet task,
- queryable readiness/status API.

## Design Goals

1. Keep the same shared seed for wallet and DID continuity.
2. Never block the UI on wallet sync or funding waits.
3. Make `/api/session` and related endpoints always responsive.
4. Expose explicit wallet/session phases to the frontend.
5. Preserve single-user simplicity. This does not need a distributed job queue.
6. Keep standalone and preprod under one model.

## Recommended Direction

Implement an in-process background task model inside `did-manager-service`.

### Core idea

Replace the current "unlock and wait until everything is ready" behavior with:

1. start wallet bootstrap in the background,
2. persist phase transitions in session state,
3. let the UI poll or subscribe to session/task status,
4. only enable DID operations when the wallet phase is `unlocked`.

This is the right level of complexity for v1. A local single-user service does not need Redis, a worker pool, or an external orchestrator.

## Proposed State Model

Add a dedicated wallet lifecycle state to the persisted manager session.

### Wallet phase

Suggested enum:

```ts
type WalletPhase =
  | 'idle'
  | 'seed-prepared'
  | 'starting'
  | 'syncing'
  | 'waiting-for-funds'
  | 'unlocked'
  | 'locking'
  | 'error';
```

### Session metadata

Persist at least:

```ts
type WalletStatus = {
  phase: WalletPhase;
  startedAt?: string;
  updatedAt: string;
  lastError?: string;
  syncState?: {
    isSynced: boolean;
    lastObservedAt: string;
  };
  fundingState?: {
    unshieldedAddress?: string;
    balance?: string;
    funded: boolean;
    faucetUrl?: string | null;
  };
  backgroundTask?: {
    id: string;
    kind: 'unlock';
    active: boolean;
  };
};
```

This belongs in the manager session file, next to the already persisted shared seed, address, and contract address.

## Recommended API Shape

The API should become state-query based instead of long-request based.

### 1. Start unlock asynchronously

Current:

- `POST /api/session/unlock`

Recommended behavior:

- returns immediately with `202 Accepted` or `200` plus current session status,
- starts or resumes a background wallet bootstrap task,
- never waits for sync/funds inline.

Suggested response:

```json
{
  "ok": true,
  "data": {
    "accepted": true,
    "taskId": "unlock:preprod",
    "status": {
      "phase": "starting"
    }
  }
}
```

### 2. Query session status

Current:

- `GET /api/session`

Recommended:

- keep it,
- extend it with wallet phase/progress/funding information,
- this becomes the primary polling endpoint for the UI.

### 3. Optional task endpoint

Useful, but not strictly required:

- `GET /api/session/task`

This can expose:

- current background task,
- active/inactive,
- last error,
- timestamps.

### 4. Optional server-sent events

Not required for v1, but a clean incremental improvement:

- `GET /api/session/events`

This would let the UI receive state transitions without polling.

Recommendation: do polling first, add SSE later if needed.

## Internal Refactor Required

The API package currently exposes a blocking helper:

- `buildWalletAndWaitForFunds(config, seed)`

This should be split into smaller composable pieces.

### Recommended API package split

Add or reuse functions like:

```ts
buildWallet(config, seed): Promise<MidnightDIDWalletContext>
waitForSync(wallet): Promise<void>
waitForFunds(wallet): Promise<bigint>
```

`waitForSync()` and `waitForFunds()` already exist separately in `api/src/lib.ts`; the manager should stop using the combined blocking helper and orchestrate these phases itself.

### Manager-side orchestration

Pseudo-flow:

1. resolve shared seed,
2. persist seed and funding address,
3. set wallet phase to `starting`,
4. start background task:
   - build wallet,
   - set phase `syncing`,
   - wait for sync,
   - set phase `waiting-for-funds`,
   - wait for positive balance,
   - configure providers,
   - initialize secret store,
   - optionally auto-join stored contract,
   - set phase `unlocked`,
5. persist any failure as `phase=error` and `lastError`.

## Concurrency and Safety Rules

This is a single-user demo service, but state transitions still need discipline.

### Recommended rules

- only one active unlock task per setup profile,
- repeated `unlock` while `starting|syncing|waiting-for-funds` should return current task status instead of starting another task,
- `lock` should cancel or invalidate the active task,
- DID operations should fail fast with a typed error unless phase is `unlocked`.

### Typed errors

Introduce manager-level errors such as:

- `WalletStartingError`
- `WalletSyncingError`
- `WalletWaitingForFundsError`
- `WalletLockedError`

This lets the API respond with structured states instead of generic `400`.

## UI / UX Recommendation

The current `/wallet` page already has the right conceptual stepper:

1. prepare shared seed,
2. fund the wallet,
3. unlock the session.

That stepper should be driven by backend wallet phase instead of request timing.

### Suggested behavior

- `seed-prepared`: step 1 done, step 2 active
- `starting|syncing`: show non-blocking progress card
- `waiting-for-funds`: show funding address, faucet link, last known balance
- `unlocked`: step 3 done, link to `/did`
- `error`: show retry action and last error

### Important requirement

The UI must remain interactive while sync is happening. At minimum, it should still be able to:

- refresh session status,
- show current setup,
- show funding address,
- show copy buttons,
- show "wallet is syncing" instead of appearing frozen.

## Persistence Recommendation

Keep using the same session file approach. It is sufficient for v1.

Persist:

- shared seed,
- unshielded address,
- remembered contract address,
- wallet phase,
- last observed balance,
- last error,
- active task metadata.

Do not persist:

- live wallet object,
- providers,
- active process handles.

Those should be reconstructed at runtime.

## Standalone vs Preprod

The same state machine should be used for both.

### Standalone

- sync and funding are usually fast,
- background model still improves responsiveness and consistency.

### Preprod

- sync and funding are slower and externally dependent,
- background model is necessary.

This means the environment difference should affect only:

- endpoints,
- faucet URL,
- expected durations.

The control flow should remain the same.

## Migration Plan

### Phase 1

Refactor without changing UI routes:

- split wallet bootstrap in manager into background phases,
- extend session status,
- keep polling from `/api/session`.

### Phase 2

Improve API semantics:

- return `202` for accepted long-running transitions,
- add task metadata,
- add typed non-ready responses for DID operations.

### Phase 3

Optional UX polish:

- SSE instead of polling,
- visible sync status details,
- live balance refresh,
- retry/cancel controls.

## Recommended First Implementation Slice

The smallest useful change is:

1. stop calling `buildWalletAndWaitForFunds()` directly from `unlock()`,
2. move wallet bootstrap into an internal background promise,
3. extend `GET /api/session` with wallet phase and last error,
4. make `/api/session/unlock` return immediately,
5. update `/wallet` to poll status and render:
   - `syncing`,
   - `waiting-for-funds`,
   - `unlocked`.

This gets the UX benefit without changing the overall service model.

## Non-Goals

Not required for this iteration:

- multi-user tenancy,
- auth/session tokens,
- distributed task queue,
- websocket-first event infrastructure,
- persistence of live wallet runtime objects,
- cross-process task recovery.

## Conclusion

The current synchronous unlock path is the wrong abstraction for a real wallet-backed web application. The correct fix is not to stretch timeouts further; it is to model wallet startup as a background state machine and expose that state through the manager API.

The existing shared-seed design should remain unchanged. It is the correct foundation for continuity between:

- funding address preparation,
- wallet unlock,
- DID ownership,
- cross-session recovery.
