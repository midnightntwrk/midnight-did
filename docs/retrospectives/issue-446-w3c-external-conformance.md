# Issue #446 external W3C conformance retrospective

Date: 2026-09-07
Canonical tracker: [midnightntwrk/midnight-did#446](https://github.com/midnightntwrk/midnight-did/issues/446)
Resolver migration: [midnightntwrk/midnight-did#447](https://github.com/midnightntwrk/midnight-did/issues/447)

## What prompted the work

The repository-owned DID Core matrices and focused conformance lane had no external harness, deterministic JSON artifact, or CI retention. Candidate analysis found that only a bounded `w3c/did-test-suite` static-fixture subset could exercise the 0.6 package without fabricating an HTTP resolver or translating incompatible Resolution semantics.

## What worked

- One machine-readable baseline binds standards, the required Node 24 major, exact npm/pnpm/Compact toolchains, upstream commit/archive/tree/lock/source hashes, mixed-license status, applied/excluded suites, assertion counts, limitations, and open registry posture. Evidence records the exact Node patch actually used.
- Trusted built package code generates the deterministic fixture before any external execution. `did-consumption` is described only as representation-consumability evidence after the public JSON-LD parser round trip.
- The trusted parent independently normalizes and validates Jest results, rejecting failed, pending, skipped, todo, missing, empty, malformed, and count-drifting output.
- CI keeps the authoritative repository lane separate from the approved external lane and names retained output with the exact checked-out SHA.

## Friction and decisions

- The upstream bootstrap runs lifecycle scripts and references an unpublished local matcher absent from the server lockfile. The harness instead verifies all three lockfiles, installs only the two required child lockfiles with scripts disabled, builds the exact verified matcher source, and never modifies or vendors upstream source.
- A persistent owner-writable cache plus owner-writable integrity marker was not a valid trust anchor. It was removed. Every diagnostic or evidence execution now creates an unpredictable mode-0700 temporary root, downloads, verifies, installs, and runs afresh, then removes the complete tree in `finally`.
- External code previously had a repository-wide filesystem read permission. Trusted adapter/setup/fixture files and only explicitly allowlisted upstream source/data now enter an isolated read-only runtime. External writes are limited to temporary raw results; the trusted parent alone emits the fixed `test-results/w3c-conformance` tree.
- The CI-only external lane is Linux-only. External matcher preparation and suite execution must restore the original non-root UID/GID, clear supplementary groups, set no-new-privileges, and enter a network namespace before external code starts. Unsupported platforms or missing isolation fail closed.
- Upstream license metadata remains mixed or unclear. [Maintainer approval is recorded](https://github.com/midnightntwrk/midnight-did/issues/446#issuecomment-5569537724) only for executing the exact unmodified snapshot and publishing exact-commit derived results with the caveat. The approval does not permit vendoring, source modification, registry submission, or package/tag/release publication.
- The registry already has an IAMX-linked `midnight` entry. Whether to update that entry or record no update remains an explicit human decision after ownership/contact continuity is confirmed; duplicate registration is forbidden.

## Validation evidence

Focused contracts cover exact pins and hashes, deterministic fixture generation, normalized evidence, fixed-output containment, symlink/race handling, mode-0700 freshness and cleanup, privilege drop, network/write denial, CI/approval fail-closed behavior, documentation generation, workflow shape, and absence of release/signing/provenance integration. An approved clean-tree external execution is expected to produce 154 applied assertions (`did-identifier` 1, `did-core-properties` 60, `did-production` 47, `did-consumption` 46) with no non-passing status. Validation results belong in the accompanying change evidence; this retrospective does not claim an immutable release run.

## Follow-ups

- **Open:** publish immutable release evidence and decide its signing/provenance policy. This CI-only slice intentionally makes no release workflow changes.
- **Open:** maintainers must confirm ownership/contact continuity and decide whether to update the existing W3C DID Extensions entry or record no update.
- #447 must land a conforming package/resolver contract before current DID Resolution or HTTP-binding suites are considered.
- Observe the first approved Linux CI execution to confirm host namespace support; sandbox absence remains a hard failure.
