# Issue #238 malformed-ledger-state retrospective

Date: 2026-08-28
Canonical tracker: [midnightntwrk/midnight-did#238](https://github.com/midnightntwrk/midnight-did/issues/238)

## What prompted the work

The original audit report predated subject-binding and canonical-duplicate
hardening. The refreshed 0.6 task therefore needed to characterize what an
authorized direct Compact caller can still persist, distinguish current
fail-closed behavior from stale silent-misbinding claims, and make malformed
ledger diagnostics deterministic without changing the frozen contract surface.

## What worked

- Raw simulator fixtures separated controller authorization from SDK validation:
  the circuits remain versioned and argument-bound while still accepting opaque
  values broader than the supported document domain.
- Fresh mapper fixtures made the layer boundary explicit. Existing malformed JWK,
  service, and alias-collision classifications were already deterministic; only
  foreign verification-method subjects escaped as an untyped error.
- Returning the normalized method id from the existing registration boundary
  avoided a second normalization call and allowed the correction to remain local
  to verification-method projection.
- Resolution-result and representation tests now assert complete null-payload
  envelopes, while convenience throwing behavior and provider `internalError`
  behavior remain visible.

## Friction and decisions

- The pinned local dev-loop installation initially contained an incomplete YAML
  dependency and had to be reprovisioned before its strict configuration checks
  could run. The installed pre-flight gate itself passed and confirmed the
  dedicated `issue-238` worktree and branch.
- Subagent support was unavailable, so the planned fan-out used the documented
  sequential fallback and recorded that limitation in temporary phase artifacts.
- No Compact change was taken. Even the bounded OKP-empty-`y` equality check would
  change managed circuit artifacts, while byte-length, canonical parsing,
  subject-binding storage, and service representation require broader 0.7 design.
- Durable malformed state is not described as permanently unresolvable: an active
  contract with retained controller custody can be repaired through ordered,
  separately finalized supported operations.

## Validation and review evidence

Focused contract and DID tests, package lint/typecheck, docs validation, DID
surface discipline, managed-artifact checks, and the mandatory full Nix
`pnpm run verify` gate passed before commit. Exact-head conformance and commit
integrity evidence are recorded after the signed commit and push.

## Follow-ups

The draft PR for #238 records the residual 0.7 work: evaluate an OKP-empty-`y`
circuit defense and separately design any fixed-size/profile-tagged coordinate
schema, fragment-bound identifier storage, structured service representation, or
migration. Those items are explicitly non-goals for 0.6 and require a dedicated
0.7 tracker decision before implementation.
