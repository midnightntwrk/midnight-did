# Main to Resolver Branch Evolution

A presentation deck for the Midnight DID repository changes between `origin/main` and `origin/resolver`.

This deck is the accurate branch-to-branch story available in the repository today.
It separates:

- Phase 1: `main -> ledger7`
- Phase 2: `ledger7 -> resolver`

---

# 1. Executive Summary

From `main` to `resolver`, the repository moved from an early DID contract/codebase into a fuller platform:

- ledger-7-native contract and runtime alignment
- stricter DID/domain canonicalization and validation
- reusable API orchestration
- stronger CLI application layer
- reusable secret-storage package
- DID resolver service
- DID manager web app
- reproducible docs site and GitHub Pages publishing pipeline

This is not one feature branch.
It is a platform maturation branch.

---

# 2. Scope of Change

Reference comparison:

- `origin/main..origin/resolver`

Approximate branch delta:

- `256` files changed
- `26994` insertions
- `5739` deletions

Interpretation:

- the branch includes the ledger-7 migration
- plus the post-migration application and documentation layers

---

# 3. Timeline Structure

The clean way to present this branch is as two phases.

Phase 1: foundation

- `main -> ledger7`
- runtime and contract migration
- spec and validation alignment
- CI/tooling stabilization

Phase 2: platform expansion

- `ledger7 -> resolver`
- resolver service
- manager service
- secret storage
- CLI state machine
- docs platform

---

# 4. Phase 1: Main to Ledger7

Core outcomes in the first phase:

- contract flow migrated to ledger-7 semantics
- legacy builder abstractions removed
- domain and DID layers tightened around canonical DID output
- reusable API workspace expanded
- CLI broadened into an operational surface
- CI and toolchain moved to current Compact and Node baselines
- specs aligned with implemented behavior

This is the architecture migration phase.

---

# 5. Phase 1: Contract and Runtime Simplification

Main contract/runtime changes:

- moved to direct circuit-oriented DID operations
- removed `ledger-operation-builder.ts`
- simplified witness-era flow
- replaced fragmented contract tests with simulator-driven lifecycle coverage

Why it matters:

- fewer abstractions between intent and circuit execution
- easier reasoning about DID lifecycle invariants
- better confidence in ledger behavior under test

Representative commits:

- `74706a7`
- `8d753a8`
- `be850ec`
- `1e3e0a1`

---

# 6. Phase 1: Domain, DID, API, CLI Alignment

Key outcomes:

- canonical DID parsing and absolute DID URL resolution
- stronger validation for key refs, aliases, and service endpoints
- reusable API orchestration surface for DID operations
- improved CLI runtime/config handling across environments
- stronger integration and unit test coverage

Representative commits:

- `411bb05`
- `839085e`
- `a9ff4c4`
- `aff0d03`
- `130564c`

---

# 7. Phase 2: Ledger7 to Resolver

After the migration stabilized, the branch added new product-facing layers:

- DID resolver service
- contract-compatible Jubjub verification
- secret-storage package
- CLI state-machine/application layer
- DID manager service
- documentation site and publishing workflow

This is the platform-enablement phase.

---

# 8. DID Resolver Service Added

New component:

- `did-resolver-service`

Capabilities:

- REST resolver API
- browser UI
- resolver caching and indexer endpoint policy
- Docker image and compose-based integration tests
- standalone and preprod run scripts

Why it matters:

- resolution becomes a deployable service, not only a library concern
- external consumers can resolve Midnight DIDs without embedding the SDK wiring themselves

Representative commits:

- `0d33337`
- `3f2678e`

---

# 9. Secret Storage and CLI Application Layer Added

New component:

- `secret-storage`

Main capabilities:

- encrypted file-backed key storage
- seed parsing and validation
- HD derivation for supported curves
- sign/verify helpers
- Veramo adapter path

CLI upgrades:

- state-machine-guided CLI API layer
- testable non-interactive orchestration
- cleaner shell separation

Why it matters:

- key custody and signing moved into a reusable package
- CLI became easier to test and evolve

Representative commit:

- `e69e3dd`

---

# 10. Jubjub Verification Became Contract-Compatible

New outcome:

- Jubjub verification implemented so domain-side and contract-side behavior align

Why it matters:

- Midnight DID support is not limited to generic key handling
- cryptographic compatibility became testable across layers

Representative commit:

- `876af06`

---

# 11. DID Manager Service Added

New component:

- `did-manager-service`

Capabilities:

- wallet setup and funding preparation
- local profile-based session management
- DID deploy/join/update/deactivate flows
- standalone and preprod usage
- Playwright coverage for UI lifecycle flows

Why it matters:

- the repo moved from library/tooling orientation to a usable web application for DID management
- this is the most visible application layer in the branch

Representative commit:

- `3ee400e`

---

# 12. Runtime Hardening After Service Introduction

Follow-up hardening work covered:

- structured seed validation
- clearer service error handling
- profile/session isolation improvements
- re-export cleanup for package publishing
- production runtime hardening for resolver and manager paths

Why it matters:

- these changes turn demo-style services into more reliable developer-facing components

Representative commits:

- `3f2678e`
- `bea6785`

---

# 13. Documentation Platform Added

New capability:

- VitePress docs site inside the repository

Included:

- package pages
- service pages
- architecture pages
- ADRs
- mirrored source markdown
- generated TypeDoc API reference
- Mermaid rendering
- GitHub Pages publishing workflow

Why it matters:

- documentation became part of the buildable platform, not scattered Markdown only

Representative commit:

- `e37c06a`

---

# 14. Developer Experience Improved Across the Repo

Repo-level improvements:

- helper runners:
  - `run-api.sh`
  - `run-cli.sh`
  - `run-resolver.sh`
  - `run-manager.sh`
  - `run-docs.sh`
- fast vs long-running pipeline split
- better ignore rules for generated state and secrets
- standalone/preprod scripts for services
- stronger local testing ergonomics

Why it matters:

- contributors can run the right scope faster
- local environments leak less state
- tests are easier to reason about by component

---

# 15. Architecture Delta in One Slide

From `main`:

- contract-heavy repository with early package split
- weaker application/service layer story
- less mature docs/testing surface

To `resolver`:

- contract + domain + DID + API base aligned on ledger-7
- CLI built on reusable application and secret-storage layers
- deployable resolver service
- deployable DID manager service
- integrated docs platform and publishing path

This branch turns the repo into a usable developer platform.

---

# 16. What Changed by Responsibility Layer

On-ledger:

- Compact DID contract simplified and stabilized

Mapping/validation:

- domain and DID canonicalization improved

Programmatic orchestration:

- API widened and hardened

User-facing tooling:

- CLI evolved
- resolver service added
- manager service added

Developer enablement:

- docs site
- runners
- improved CI/tooling

---

# 17. Suggested Narrative for Presentation

Recommended presentation order:

1. explain why `main` is no longer the right baseline
2. describe phase 1 as the ledger-7 migration foundation
3. describe phase 2 as the service/application expansion on top of that foundation
4. end with what the branch enables next: publishable packages, deployable services, and clearer use-case-driven evolution

This avoids mixing migration work with later productization work.

---

# 18. Commit Milestones Appendix

Phase 1 milestones:

- `74706a7` minimal DID contract foundation
- `411bb05` reusable API workspace
- `1e3e0a1` migration to ledger-7
- `aff0d03` complete ledger-7 alignment and CI/tooling migration
- `130564c` type safety and normalization cleanup

Phase 2 milestones:

- `0d33337` DID resolver service
- `876af06` Jubjub verification
- `e69e3dd` CLI state machine + secret storage
- `3ee400e` DID manager service
- `bea6785` seed validation and error handling hardening
- `e37c06a` docs platform and generated API reference

---

# 19. Closing Message

`resolver` is best understood as:

- a ledger-7 migration branch
- plus the first serious application and documentation layer built on top of it

If the audience only remembers one thing:

- the branch did not just migrate the runtime
- it established the repository as a foundation for usable Midnight DID tooling and services
