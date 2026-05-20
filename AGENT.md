# AGENT

Engineering guide for agents and engineers working in `midnight-did`.

This repository can be cloned independently or checked out as `midnight-identity-workspace/midnight-did`. When it is used inside the workspace, also read the workspace-root `AGENT.md` for cross-repo coordination.

## Purpose

`midnight-did` is the reference implementation of the `did:midnight` method. It owns the DID Compact contract, shared JubJub Schnorr helpers, DID document/domain model, ledger-to-domain mapping, and TypeScript API orchestration.

Resolver services, DID manager service/UI, and reusable secret storage live in `midnight-did-resolver`. VC/VP packages and use cases live in `midnight-verifiable-credentials`. Do not add those components back into this repository.

## Quick Start

Prerequisites:

- Node.js 24
- Docker for API integration tests
- Midnight Compact toolchain
- Nix when working from the identity workspace

Standalone setup:

```bash
npm ci
compact update 0.30.0
```

Fast validation:

```bash
./run.sh --light --strict
```

Full validation:

```bash
PROOF_SERVER_IMAGE=proof-server-bootstrap:8.0.3 ./run.sh --strict
```

## Midnight MCP Configuration

For Codex or another MCP-capable client, configure the Midnight MCP server at user level. Do not commit personal MCP config or tokens.

```toml
[mcp_servers.midnight]
command = "npx"
args = ["-y", "midnight-mcp@latest"]
```

Use it to inspect Compact entry points, generated `src/managed` outputs, TypeScript exports, and package wiring. Always confirm changes with local scripts and tests.

## Package Map

| Path | Package | Responsibility |
| --- | --- | --- |
| `packages/contract` | `@midnight-ntwrk/midnight-did-contract` | Compact contract for on-ledger DID state and circuit rules. |
| `packages/jubjub-schnorr` | `@midnight-ntwrk/midnight-did-jubjub-schnorr` | Shared Compact/TS JubJub Schnorr transcript, digest, signature, and verification helpers. |
| `packages/domain` | `@midnight-ntwrk/midnight-did-domain` | DID document schemas, validation, canonicalization, field encoding, and method-specific domain types. |
| `packages/did` | `@midnight-ntwrk/midnight-did` | Ledger-to-domain mapping, DID resolution helpers, and method-specific conversion logic. |
| `packages/api` | `@midnight-ntwrk/midnight-did-api` | Runtime orchestration for wallets, providers, contracts, network profiles, and DID operations. |
| `docs-site` | `docs-site` | VitePress documentation site and generated API reference for DID-owned packages. |

## Architecture Boundaries

Core dependency direction:

```text
contract -> generated runtime artifacts
jubjub-schnorr -> shared Compact/TS Schnorr implementation
domain -> DID document and method data model
did -> domain + contract mapping and resolver helpers
api -> did/domain/contract + wallet/provider/runtime orchestration
```

Rules:

- Keep DID method semantics in `packages/contract`, `packages/domain`, `packages/did`, and `packages/api`.
- Keep resolver service, manager service, and local secret custody in `midnight-did-resolver`.
- Keep VC/VP semantics in `midnight-verifiable-credentials`.
- Keep Passport/product flows in examples/product repos.
- Keep `jubjub-schnorr` as the single source of truth for JubJub Schnorr transcript logic.

## Compact and TypeScript Source Rules

Important source files:

- `packages/contract/src/did.compact`: DID contract source of truth.
- `packages/jubjub-schnorr/src/schnorr.compact`: shared Schnorr Compact module.
- `packages/jubjub-schnorr/src/jubjub-schnorr.compact`: managed-wrapper contract used for TS `pureCircuits`.
- `packages/jubjub-schnorr/src/signing.ts`: TypeScript signer/verifier helper source of truth.

Generated outputs:

- `src/managed/**`
- `dist/**`
- `*.tsbuildinfo`

Generated outputs are build artifacts. Do not manually edit them.

When changing Compact circuits:

1. Update the Compact source.
2. Run the package build that regenerates managed artifacts.
3. Run package tests that exercise the generated runtime.
4. Verify downstream imports still use package names rather than deep workspace-relative source paths.

For shared Schnorr changes, run:

```bash
npm run test -w ./packages/contract
```

## Development Cycle

1. Start from `origin/develop` unless asked otherwise.
2. Create a focused branch, normally with `codex/` prefix.
3. Change the owning package and nearby docs/tests together.
4. Run a focused package lane.
5. Run `./run.sh --light --strict` before considering the repo stable.
6. Run full `./run.sh --strict` for release-facing or integration-heavy changes.
7. Commit with DCO and GPG for repository-facing work.

Commit form:

```bash
git commit -S --signoff -m "<type>: <subject>"
```

## Runner Targets

Main runner:

```bash
./run.sh [target] [--light] [--strict] [--metrics] [--metrics-json <file>] [--skip-coverage]
```

Useful forms:

```bash
./run.sh targets
./run.sh --light --strict
./run.sh core --strict
./run.sh api --light --strict
./run.sh docs
./run.sh clean-artifacts
./run.sh integration-report
./run.sh check-integration
```

Target catalog check:

```bash
npm run check:run-target-catalog
```

Lane scripts:

| Target | Script | Purpose |
| --- | --- | --- |
| `./run.sh core` | `./run-core.sh` | Core package lint/build/test path. |
| `./run.sh api` | `./run-api.sh` | DID API lane. |
| `./run.sh docs` | `./run-docs.sh` | Docs generation/build lane. |

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
npm run check:run-target-catalog
npm run clean:artifacts
npm run report:integration
npm run check:integration
npm run artifacts:pack
```

Package examples:

```bash
npm run build -w ./packages/contract
npm run test:ci -w ./packages/contract
npm run build -w ./packages/domain
npm run test:ci -w ./packages/domain
npm run build -w ./packages/did
npm run test:ci -w ./packages/did
npm run build -w ./packages/api
npm run test:ci -w ./packages/api
```

## Services and Manual Testing

Start docs:

```bash
./start-docs.sh
```

Resolver and manager service manual testing moved to `midnight-did-resolver`.

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

## CI Shape

GitHub Actions target `main` and `develop`.

Main jobs:

- `core`: lint plus contract/domain/DID validation.
- `services`: API lane.
- `docs`: docs build and optional GitHub Pages deployment.
- `scan`: security scanning.
- `pr-check`: semantic PR title and non-empty PR body checks.

## Docs

Docs entry points:

- `README.md`: repository overview and command matrix.
- `docs-site/guide/local-development.md`: local development guide.
- `docs-site/guide/testing-strategy.md`: testing strategy.
- `docs-site/guide/did-surface-change-discipline.md`: discipline for DID surface changes.
- `docs/repository-audit-backlog.md`: current maturity/simplification backlog.
- `w3c-spec/midnight-method.md`: method specification material.
- `w3c-spec/midnight-did-traits.md`: method traits.

Update docs when changing public APIs, contract behavior, package distribution, runner behavior, or DID method semantics.

## Cross-Repository Boundaries

Use `midnight-did-resolver` for resolver service, DID manager, secret storage, service docs, and service runtime scripts.
Use `midnight-verifiable-credentials` for VC/VP packages, credential families, university BDD, status/revocation, and standalone VC integration.
Use `midnight-trust-registry` for trust-registry and governance integration work.

When a DID package change is needed downstream, land it in DID first, pack artifacts, then consume tarballs downstream.

## Troubleshooting

Clean stale local Docker/test infra:

```bash
./scripts/cleanup-test-infra.sh
```

Common fixes:

- `EADDRINUSE`: stop the conflicting process or run cleanup script.
- Slow proof server startup: use `PROOF_SERVER_IMAGE=proof-server-bootstrap:8.0.3` if available.
