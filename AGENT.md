# AGENT

Engineering guide for agents and engineers working in `midnight-did`.

This repository can be cloned independently or checked out as `midnight-identity-workspace/midnight-did`. When it is used inside the workspace, also read the workspace-root `AGENT.md` for cross-repo coordination. This file is the authority for DID repository package boundaries, validation, packaging, and local runtime behavior.

## Purpose

`midnight-did` is the reference implementation of the `did:midnight` method. It owns the DID contract, domain model, resolver/conversion logic, API orchestration, web services, documentation site, shared JubJub Schnorr helpers, and reusable secret storage.

VC packages, university BDD scenarios, and Passport/product examples are intentionally split into separate repositories. Do not add new VC use-case or Passport-specific logic back into this repository.

## Quick Start

Prerequisites:

- Node.js 24
- Docker for standalone integration and service tests
- Midnight Compact toolchain
- Nix is the preferred way to get the shared toolchain when working from the identity workspace

Standalone setup:

```bash
npm ci
compact update 0.30.0
```

Workspace setup:

```bash
cd /path/to/midnight-identity-workspace
nix develop
cd midnight-did
npm ci
```

Fast repository validation:

```bash
./run.sh --light
```

Full repository validation:

```bash
PROOF_SERVER_IMAGE=proof-server-bootstrap:8.0.3 ./run.sh
```

Use `./run.sh --help` for supported runner flags.

## Midnight MCP Configuration

For Codex or another MCP-capable client, configure the Midnight MCP server at user level. Do not commit personal MCP config or tokens.

```toml
[mcp_servers.midnight]
command = "npx"
args = ["-y", "midnight-mcp@latest"]
```

Use it to inspect Compact entry points, generated `src/managed` outputs, TypeScript package exports, and cross-package wiring. Always confirm changes with local scripts and tests.

## Repo-Local Codex Skill

This repository distributes a lightweight Codex skill at `.codex/skills/midnight-identity/`.

Use it when a task starts from an independent `midnight-did` clone and needs DID-specific validation, packaging, Compact artifact, service, or DID/VC boundary reminders. The skill intentionally points agents back to this `AGENT.md` as the detailed source of truth.

## Package Map

| Path | Package | Responsibility |
| --- | --- | --- |
| `contract` | `@midnight-ntwrk/midnight-did-contract` | Compact contract for on-ledger DID state and circuit rules. |
| `jubjub-schnorr` | `@midnight-ntwrk/midnight-did-jubjub-schnorr` | Shared Compact and TypeScript JubJub Schnorr transcript, digest, signature, and verification helpers. |
| `domain` | `@midnight-ntwrk/midnight-did-domain` | DID document schemas, validation, canonicalization, field encoding, and method-specific domain types. |
| `did` | `@midnight-ntwrk/midnight-did` | Ledger-to-domain mapping, DID resolution helpers, and method-specific resolver logic. |
| `api` | `@midnight-ntwrk/midnight-did-api` | Runtime orchestration for wallets, providers, contracts, network profiles, DID operations, and standalone/preprod/mainnet config. |
| `secret-storage` | `@midnight-ntwrk/midnight-did-secret-storage` | Encrypted key storage, HD derivation, key references, and application-facing signing helpers. |
| `did-resolver-service` | `@midnight-ntwrk/midnight-did-resolver-service` | REST/Swagger/UI resolver service. |
| `did-manager-service` | `@midnight-ntwrk/midnight-did-manager-service` | DID manager backend and minimal browser UI. |
| `docs-site` | `docs-site` | VitePress documentation site and generated API reference. |

## Architecture Boundaries

Core dependency direction:

```text
contract -> generated runtime artifacts
jubjub-schnorr -> shared Compact/TS Schnorr implementation
domain -> DID document and method data model
did -> domain + contract mapping and resolver helpers
api -> did/domain/contract + wallet/provider/runtime orchestration
secret-storage -> encrypted local key material and signing helpers
services -> api/domain/did packages
```

Rules:

- Keep DID method semantics in `contract`, `domain`, `did`, and `api`.
- Keep product UX in service packages or external examples, not in core packages.
- Keep VC/VP semantics in `midnight-verifiable-credentials`.
- Keep Passport/product credential families in examples/product repos.
- Keep `jubjub-schnorr` as the single source of truth for JubJub Schnorr transcript logic.
- `secret-storage` should consume `@midnight-ntwrk/midnight-did-jubjub-schnorr`, not reimplement challenge derivation.

## Compact and TypeScript Source Rules

Important source files:

- `contract/src/did.compact`: DID contract source of truth.
- `jubjub-schnorr/src/schnorr.compact`: shared Schnorr Compact module.
- `jubjub-schnorr/src/jubjub-schnorr.compact`: managed-wrapper contract used for TS `pureCircuits`.
- `jubjub-schnorr/src/signing.ts`: TypeScript signer/verifier helper source of truth.
- `secret-storage/src/index.ts`: public application-facing re-export surface for storage and signing helpers.

Generated outputs:

- `src/managed/**`
- `dist/**`
- `*.tsbuildinfo`

Generated outputs are build artifacts. Do not manually edit them. If a package is distributed through `npm pack`, make sure its `files` whitelist and build/prepack behavior include the generated outputs it needs.

When changing Compact circuits:

1. Update the Compact source.
2. Run the package build that regenerates managed artifacts.
3. Run package tests that exercise the generated runtime, not only compile checks.
4. Verify downstream package imports still use package names rather than deep workspace-relative source paths.

For shared Schnorr changes, run:

```bash
npm run test -w contract
```

That runtime test is stronger than a compile-only check because it exercises the impure Schnorr verifier and witness binding.

## Development Cycle

1. Start from `origin/develop` unless asked otherwise.
2. Create a focused branch, normally with `codex/` prefix.
3. Change the owning package and nearby docs/tests together.
4. Run a focused package lane.
5. Run `./run.sh --light` before considering the repo stable.
6. Run full `./run.sh` for release-facing or integration-heavy changes.
7. Commit with DCO and GPG for repository-facing work.

Commit form:

```bash
git commit -S --signoff -m "<type>: <subject>"
```

## Root Runner Targets

Main runner:

```bash
./run.sh [--light] [--strict] [--metrics] [--metrics-json <file>] [--skip-coverage]
```

Useful forms:

```bash
./run.sh --light
./run.sh --light --strict --skip-coverage --metrics
./run.sh --light --strict --skip-coverage --metrics --metrics-json /tmp/midnight-did-run.json
PROOF_SERVER_IMAGE=proof-server-bootstrap:8.0.3 ./run.sh
```

Lane scripts:

| Script | Purpose |
| --- | --- |
| `./run-core.sh` | Core package lint/build/test path. |
| `./run-api.sh` | DID API lane. |
| `./run-resolver.sh` | Resolver service lane. |
| `./run-manager.sh` | DID manager service and browser UI lane. |
| `./run-docs.sh` | Docs generation/build lane. |

`./run.sh` validates DID core/API/resolver/manager only. It does not run VC or Passport pipelines.

## NPM Scripts

Common root scripts:

```bash
npm run lint
npm run lint:core
npm run build:all
npm run typecheck:all
npm run test:all
npm run ci:core
npm run check:did-surface-discipline
npm run artifacts:pack
```

Package examples:

```bash
npm run build -w contract
npm run test:ci -w contract
npm run build -w domain
npm run test:ci -w domain
npm run build -w did
npm run test:ci -w did
npm run build -w secret-storage
npm run test:ci -w secret-storage
```

## Services and Manual Testing

Start DID manager:

```bash
./start-manager.sh
./start-manager.sh --preprod
./start-manager.sh --mainnet
```

Start resolver:

```bash
./start-resolver.sh
./start-resolver.sh --preprod
./start-resolver.sh --mainnet
```

Start docs:

```bash
./start-docs.sh
```

Network behavior:

- `standalone` uses local Docker node/indexer/proof-server infrastructure.
- `preprod` and `mainnet` use public indexer endpoints.
- `mainnet` expects real funded wallet material and does not use a faucet.

DID manager local state lives under `~/.midnight-did` by default. Treat it as sensitive. Use `DID_MANAGER_DATA_DIR` when you need isolated test state.

## Playwright Guidance

DID manager browser tests:

```bash
npm run test:e2e:standalone -w did-manager-service
```

Install browsers if needed:

```bash
npm run playwright:install -w did-manager-service
```

Show report:

```bash
npx playwright show-report did-manager-service/playwright-report
```

If UI tests wait forever after wallet navigation, check whether the page has rehydrated session state before clicking session-close controls.

## Packaging and Distribution

Pack unpublished DID packages into a stable local artifact directory:

```bash
npm run artifacts:pack
```

Refresh a downstream repo or vendor directory:

```bash
./upgrade-libs.sh --destination /path/to/downstream-repo
```

Packed packages:

- `@midnight-ntwrk/midnight-did-api`
- `@midnight-ntwrk/midnight-did-domain`
- `@midnight-ntwrk/midnight-did`
- `@midnight-ntwrk/midnight-did-jubjub-schnorr`
- `@midnight-ntwrk/midnight-did-contract`
- `@midnight-ntwrk/midnight-did-secret-storage`

Rules:

- Build tarballs into `artifacts/npm/`.
- Do not hand-copy `dist/` to downstream repos.
- Ensure packed packages include generated `dist/**` and required managed artifacts.
- If VC or examples repos consume local DID tarballs, refresh via `upgrade-libs.sh` or workspace helpers.

## CI Shape

GitHub Actions target `main` and `develop`.

Main jobs:

- `core`: lint plus contract/domain/DID/secret-storage validation.
- `services`: matrix for API, resolver, and manager scripts.
- `docs`: docs build and optional GitHub Pages deployment.
- `scan`: security scanning.
- `pr-check`: semantic PR title and non-empty PR body checks.

CI uses Compact toolchain setup, Node 24, npm cache, Playwright browser cache for manager tests, and optional `PROOF_SERVER_IMAGE` optimization.

## Docs

Docs entry points:

- `README.md`: repository overview and command matrix.
- `docs-site/guide/local-development.md`: local development guide.
- `docs-site/guide/testing-strategy.md`: testing strategy.
- `docs-site/guide/did-surface-change-discipline.md`: discipline for DID surface changes.
- `docs/repository-audit-backlog.md`: current maturity/simplification backlog.
- `w3c-spec/midnight-method.md`: method specification material.
- `w3c-spec/midnight-did-traits.md`: method traits.

Update docs when changing public APIs, service behavior, package distribution, run scripts, or DID method semantics.

## Cross-Repository Boundaries

Use `midnight-verifiable-credentials` for:

- VC/VP generic envelope work
- credential families
- status/revocation capability work
- university BDD and protocol scenarios
- standalone VC integration

Use `midnight-identity-solution-examples` for:

- Passport/product flows
- browser demo UX
- product-specific credential families

Use `midnight-trust-registry` for:

- trust-registry and governance integration work

When a DID package change is needed by VC/examples, land it in DID first, pack artifacts, then consume tarballs downstream.

## Troubleshooting

Clean stale local Docker/test infra:

```bash
./scripts/cleanup-test-infra.sh
```

Common fixes:

- `EADDRINUSE`: stop the conflicting process or run cleanup script.
- Slow proof server startup: use `PROOF_SERVER_IMAGE=proof-server-bootstrap:8.0.3` if available.
- Missing managed artifacts: run the owning package build rather than copying files.
- Packed package missing generated files: check `files` whitelist and build/prepack behavior.
- Wallet restore/state decode errors: use isolated state or clean only the affected local profile state.
