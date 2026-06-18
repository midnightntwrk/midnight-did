# Ledger4 to Ledger7 Migration

A high-level presentation deck for the Midnight DID repository migration to ledger-7.

> Scope note: this repository no longer contains a surviving `ledger4` branch or tag. This deck reconstructs the migration story from the `ledger7` commit chain and the delta between `origin/main` and `origin/ledger7`. It intentionally excludes later `resolver`-branch additions such as the DID resolver service, DID manager service, secret-storage package, and docs site.

---

# 1. Executive Summary

The ledger-7 migration was a repository-wide refactoring program, not just a runtime upgrade.

It delivered:

- a ledger-7-native DID contract flow
- a cleaner package architecture
- stronger domain validation and canonicalization
- a reusable API layer for DID operations
- a more operational CLI surface
- more realistic lifecycle testing
- CI and tooling aligned with the new baseline

Core message:

- the repository moved from an early implementation to a more coherent platform foundation

---

# 2. Why We Had to Migrate

Before the migration, the repository had several pressure points:

- contract flow still reflected older ledger assumptions
- some abstractions no longer matched the actual runtime model
- lifecycle behavior was harder to reason about across layers
- validation and specification text were drifting apart
- local and CI environments were becoming harder to keep consistent

The migration goal was to make the whole stack speak one model.

---

# 3. What Changed at a High Level

The migration changed five things at once:

1. Contract execution model
2. Package boundaries and responsibilities
3. DID validation and canonicalization
4. Test strategy
5. CI and developer tooling

That is why this work should be presented as a refactoring and architecture alignment effort, not only a feature delivery.

---

# 4. Refactoring Theme 1: Contract Simplification

The contract layer was simplified around direct DID lifecycle circuits.

Main refactorings:

- removed obsolete builder-style flow
- removed outdated witness-era complexity
- replaced indirect operation abstractions with more direct circuit intent
- consolidated contract lifecycle tests around a simulator-based model

Why this mattered:

- fewer moving parts
- clearer trace from API intent to on-ledger behavior
- easier maintenance and debugging

---

# 5. Refactoring Theme 2: Clearer Package Architecture

The migration clarified what each package is responsible for.

The resulting architecture became:

- `contract`: on-ledger DID rules and circuits
- `domain`: schemas, normalization, validation
- `did`: ledger-to-domain mapping and DID resolution helpers
- `api`: orchestration and runtime/provider integration
- `cli`: user-facing operational entrypoint

Why this mattered:

- less responsibility overlap
- fewer hidden conversions between layers
- a better base for future services

---

# 6. New and Strengthened Components

During the migration window, the repo gained or significantly matured these components:

- `domain` package as the source of truth for DID validity
- `did` package for ledger-to-domain resolution behavior
- reusable `api` package for programmatic DID operations
- stronger CLI runtime/config surface for real environments

This is the key “new components” message for the ledger-7 phase.

These were the building blocks later used by the resolver and manager services.

---

# 7. Refactoring Theme 3: Canonicalization and Spec Alignment

A major part of the migration was semantic cleanup.

Main improvements:

- canonical DID parsing
- absolute DID URL resolution in resolved output
- stricter validation of:
  - verification method references
  - aliases
  - service endpoints
- tighter alignment between spec text and implementation behavior

Why this mattered:

- Midnight DID behavior became more predictable for integrators
- resolution output became more consistent with DID Core expectations
- tests, code, and docs started describing the same rules

---

# 8. Refactoring Theme 4: Better Testing Strategy

The migration upgraded testing from fragmented coverage to lifecycle-oriented confidence.

Key changes:

- simulator-driven contract tests
- broader API integration coverage
- stronger package-level validation tests
- better environment setup for standalone/local execution

Impact:

- lifecycle bugs became easier to catch
- regressions became easier to localize
- CI became a more faithful representation of real usage

---

# 9. Refactoring Theme 5: CI and Tooling Baseline

The migration also modernized the engineering baseline.

Main changes:

- Compact toolchain pinned and updated
- CI flow aligned with current Compact setup actions
- Node runtime baseline updated
- proof-server and standalone setup improved
- lockfile/install behavior hardened for CI

Why this mattered:

- a migration is only real if developers and CI can reproduce it
- toolchain stability was necessary to make the refactor sustainable

---

# 10. What Was Removed

Just as important as what was added:

- obsolete ledger-operation builder flow
- outdated forward-mapping helpers that no longer matched the preferred architecture
- fragmented legacy tests
- stale example/submodule artifacts that no longer served the workspace

This reduced architectural noise and made the repo easier to explain.

---

# 11. What the Migration Enabled Next

Ledger-7 did not end the story. It created the base for later work.

It enabled:

- safer DID normalization and parsing
- cleaner API-driven operations
- stronger CLI evolution
- later resolver and manager services built on top of stable lower layers

This is the strategic value of the migration:

- it created a platform foundation, not only a passing branch state

---

# 12. Suggested One-Slide Conclusion

If you need to compress the story to one slide:

- We refactored Midnight DID to be ledger-7-native across contract, domain, DID mapping, API, CLI, tests, and tooling.
- We removed older abstractions that no longer fit the runtime.
- We introduced clearer package boundaries and stronger validation/canonicalization.
- We replaced fragmented testing with more realistic lifecycle coverage.
- We aligned CI, tooling, and spec text with the implementation.
- The result was a cleaner and more extensible foundation for future services.

---

# 13. Suggested Talking Points for Q&A

If someone asks what the migration really changed, emphasize:

- the contract flow was simplified
- the package architecture became clearer
- DID behavior became more canonical and spec-consistent
- testing moved closer to real lifecycle behavior
- the repo became a stable base for later resolver/manager/product work

---

# 14. Evidence Appendix

Useful milestone commits to reference verbally:

- `74706a7` minimal DID contract foundation
- `03f64d4` domain and did package introduction
- `8d753a8` contract simplification by removing witnesses
- `be850ec` move toward individual circuits
- `411bb05` reusable API workspace
- `1e3e0a1` migration to ledger-7
- `aff0d03` complete ledger-7 alignment and CI/tooling migration
- `130564c` tighten DID parsing and codec type safety
