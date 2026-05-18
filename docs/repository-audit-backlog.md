# Midnight DID Repository Audit Backlog

Status: current simplification and maintenance backlog for the `develop`
branch.

Last reviewed: 2026-05-19.

## Scope

This audit covers:

- root workspace and script topology
- `./run.sh` and split lane runners
- tracked workspace package map
- ignored/generated artifact footprint
- DID/VC repository boundary clarity
- documentation entrypoints used by new contributors

## Current Repository Shape

The `develop` branch now has a clearer tracked workspace boundary than earlier
audit snapshots:

- `contract`
- `jubjub-schnorr`
- `domain`
- `did`
- `api`
- `secret-storage`
- `did-resolver-service`
- `did-manager-service`
- `docs-site`

The earlier ambiguity around `did-manager-service`, `secret-storage`, and
`docs-site` is mostly resolved because they are now first-class workspaces.
The remaining simplification work is about reducing duplicated runner/script
state, documenting local artifact hygiene, and keeping DID/VC split-repo
boundaries explicit.

## Current Strengths

- root README lists current workspace components and points VC/Passport work to
  split repositories
- root `./run.sh` supports `--light`, `--strict`, `--metrics`, and
  `--metrics-json`
- `npm run ci:core` gates DID surface discipline before the core package lane
- service runners prepare missing contract artifacts explicitly
- generated docs-site output, local databases, package artifacts, and build
  outputs are ignored

## Priority Simplification Findings

### P1. Runner state is split across too many files

Current state:

- root `package.json` repeats workspace filters for `clean`, `lint`,
  `lint:fix`, `typecheck:all`, `ci:core`, and package build/test lanes
- `./run.sh` delegates to `run-core.sh`, `run-api.sh`, `run-resolver.sh`, and
  `run-manager.sh`
- each lane repeats setup, cleanup, node/runtime checks, and artifact
  preparation details

Backlog:

1. define a small runner target catalog for:
   - target name
   - workspace package list
   - prerequisite artifact profile
   - light-mode behavior
   - strict-mode behavior
2. validate root scripts and runner help against that catalog
3. keep lane scripts as thin wrappers over catalog entries instead of
   accumulating per-lane policy

### P1. DID/VC boundary should have one executable contract

Current state:

- README says VC and Passport work now live outside this repository
- VC still consumes DID packages through tarballs, sibling checkouts, or
  local package aliases depending on the developer workflow
- the active integration mode is not reported by one DID-side command

Backlog:

1. add a DID package export/version report command that downstream repos can
   run before local VC validation
2. document the supported integration modes:
   - published/tarball package set
   - sibling checkout
   - vendor snapshot
3. keep VC-specific scenarios out of DID, but keep DID package compatibility
   reporting first-class

### P1. Generated artifact cleanup is still implicit

Current state:

- ignored local state includes `dist`, `coverage`, `.turbo`,
  `midnight-level-db`, `.midnight-db`, Playwright reports, docs-site build
  output, package tarballs, and generated Compact `managed` trees
- developers can inspect `git status --ignored`, but there is no canonical
  cleanup command in the README

Backlog:

1. add `npm run clean:artifacts` or `./run.sh clean-artifacts`
2. remove only known generated state and preserve user secrets/session files
3. document cleanup safety rules near the artifact packaging section

### P2. Docs-site source/output model needs a short boundary note

Current state:

- docs-site generated output and source sync outputs are ignored
- root README references docs-site as a first-class workspace
- the distinction between authored docs and synced/generated docs-site content
  is easy to miss

Backlog:

1. document authored docs versus generated/synced docs-site content
2. make `docs:sync-source` idempotence expectations explicit
3. add a docs-source drift check if docs-site source is expected to reflect
   root docs before CI

### P2. Root `ci` and root `./run.sh` are not the same contract

Current state:

- `npm run ci` runs lint, build, and package tests
- `./run.sh` runs core, API, resolver, and manager pipelines
- CI workflow may call one path while local contributors call another

Backlog:

1. document which command is authoritative for PR validation
2. add a runner-contract test that proves README, package scripts, and workflow
   entrypoints agree
3. prefer `./run.sh --light --strict` as the local smoke path and reserve
   `npm run ci` for package-only validation if both remain

### P2. DID manager is now first-class, but product boundaries should stay thin

Current state:

- `did-manager-service` is a workspace with UI/service scope
- manager work can grow quickly into product-specific flows that belong in
  adjacent demos

Backlog:

1. keep manager focused on DID CRUD, key management, session state, and raw DID
   document inspection
2. document non-goals:
   - VC issuance flows
   - Passport-specific flows
   - university/mall/student workflows
3. add a small API boundary test for manager routes when route count grows

### P3. Surface-change discipline should cover runner and package manifest drift

Current state:

- `check:did-surface-discipline` protects DID surface-change docs and PR
  template expectations
- package manifest and runner topology changes are still mostly reviewed
  manually

Backlog:

1. add a package/workspace manifest audit similar to the VC repository
2. add a runner target contract check for root scripts and lane wrappers
3. include these checks in `ci:core` or the root lint lane once stable

## Next 10 Simplification Items

1. `runner-target-catalog`
- centralize DID runner/package target definitions and validate scripts against
  them

2. `clean-artifacts-target`
- add a safe cleanup lane for generated build/test/report artifacts

3. `did-vc-integration-report`
- emit DID package versions, tarball paths, and sibling-checkout status for VC
  consumers

4. `docs-site-boundary-note`
- document authored docs versus generated/synced docs-site files

5. `root-ci-run-contract`
- reconcile or explicitly separate `npm run ci` and `./run.sh` semantics

6. `workspace-manifest-audit`
- verify workspace package names, private/package status, `files`, exports, and
  service/documentation package policies

7. `manager-non-goals`
- keep DID manager scope limited to DID CRUD and key/session management

8. `runner-metrics-baseline`
- store a lightweight baseline for `./run.sh --light --strict --metrics-json`
  so regressions are visible

9. `docs-link-check`
- add a fast markdown link/script-reference check over root docs and README

10. `legacy-artifact-boundary`
- keep ignored VC/Passport/build residues clearly outside the DID repository
  source boundary and document the cleanup story
