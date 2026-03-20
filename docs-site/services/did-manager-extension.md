# Extending Manager

The manager service is intentionally a single-user demo-style application. Extend it carefully, because it mixes wallet lifecycle, local profile state, and DID operations.

## Good extension points

1. `src/manager.ts`
   Extend orchestration rules, session behavior, and profile handling.
2. `src/app.ts`
   Add API routes, auth gates, or status endpoints.
3. `src/ui.ts`
   Improve the browser UI while keeping the API contract stable.
4. `src/session-store.ts`
   Evolve profile persistence and migration logic.

## Safe changes

- better status polling and background sync
- stronger observability and error reporting
- improved UI flows for funding, unlock, and contract selection
- additional validation around user-entered DID updates

## Changes to avoid casually

- moving secret material into the browser
- making the resolver and manager share mutable local state
- treating the current single-user profile model as multi-tenant ready

## Recommended next architecture step

The clearest future refactor is to split:

- profile/session persistence
- wallet runtime lifecycle
- DID lifecycle orchestration

That reduces the responsibility load currently centered in `src/manager.ts`.
