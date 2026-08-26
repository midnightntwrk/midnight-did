# Issue #433 promotion-compatibility retrospective

Date: 2026-08-20
Canonical tracker: [midnightntwrk/midnight-did#433](https://github.com/midnightntwrk/midnight-did/issues/433)
Source review: [PR #431 comment 5354818857](https://github.com/midnightntwrk/midnight-did/pull/431#issuecomment-5354818857)

## What prompted the work

Exact-head promotion review found four compatibility gaps already present on
`develop`: the deprecated Schnorr verifier selected the legacy fragment key
without checking canonical storage, historical path-form verification method ids
were rejected, foreign-DID legacy service rendering and document validation used
contradictory policies, and network-path method ids escaped structured resolver
diagnostics. The fixes belong on `develop`, not on the promotion branch.

## What worked

- The four findings shared one narrow theme: canonical logical identifiers versus
  historical physical ledger representations. Keeping that boundary explicit
  avoided contract or resolver-service changes.
- Existing canonical/legacy key-selection helpers already failed closed, so the
  deprecated verifier could reuse them whenever an API-created contract handle
  retained its providers.
- A read-only compatibility option made legacy foreign-DID service rendering and
  subsequent document validation agree without weakening `addService` or
  `updateService` validation.
- Focused parser and resolver cases made the accepted historical path subset and
  the still-rejected unrelated references executable policy.

## Friction and decisions

- The four-argument verifier has no providers parameter. API lifecycle helpers now
  associate providers with their returned contract handles in a `WeakMap`; those
  handles get state-aware canonical/legacy resolution and ambiguity detection.
  Unregistered handles retain the deprecated fragment fallback and callers are
  directed to the provider-aware overload.
- Path-only and dot-relative verification method ids are retained for document
  parsing and ledger resolution. New mutation inputs continue to require a
  non-empty fragment, avoiding a broader write-policy change.
- Existing foreign-DID service ids are preserved only while reconstructing
  historical ledger documents. Default document parsing and all new ledger writes
  remain subject-bound.
- Network-path verification method keys are classified at the ledger mapping
  boundary as `invalidDid`, rather than loosening DID URL resolution.

## Validation and review evidence

Focused domain, DID, API, resolver, parser, and fuzz checks are recorded in the
PR. Full Nix verification, documentation build/visual checks, commit integrity,
hosted CI, and exact-head routed review are recorded after the final push.

## Follow-ups

No broad identifier refactor was taken. The lower-priority observations from the
source review remain outside issue #433 unless a separate issue establishes
scope and compatibility requirements.
