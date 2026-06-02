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
pnpm install
compact update 0.30.0
```

Fast validation:

```bash
./run.sh --light --strict
```

Current stabilization checkpoint, 2026-05-29: develop at `195cd6f` matched `origin/develop` after PR #169 merged. The repository is pnpm/Turbo-native and the DID contract uses the split key-storage model described below. Long-running API integration remains opt-in through the full runner.

Full validation:

```bash
PROOF_SERVER_IMAGE=proof-server-bootstrap:8.0.3 ./run.sh --strict
```

## Midnight MCP Configuration

For Codex or another MCP-capable client, configure the Midnight MCP server at user level. Do not commit personal MCP config or tokens.

```toml
[mcp_servers.midnight]
command = "pnpm"
args = ["dlx", "midnight-mcp@latest"]
```

Use it to inspect Compact entry points, generated `src/managed` outputs, TypeScript exports, and package wiring. Always confirm changes with local scripts and tests.

## Package Map

| Path                      | Package                                       | Responsibility                                                                                        |
| ------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `packages/contract`       | `@midnight-ntwrk/midnight-did-contract`       | Compact contract for on-ledger DID state and circuit rules.                                           |
| `packages/jubjub-schnorr` | `@midnight-ntwrk/midnight-did-jubjub-schnorr` | Shared Compact/TS JubJub Schnorr transcript, digest, signature, and verification helpers.             |
| `packages/domain`         | `@midnight-ntwrk/midnight-did-domain`         | DID document schemas, validation, canonicalization, field encoding, and method-specific domain types. |
| `packages/did`            | `@midnight-ntwrk/midnight-did`                | Ledger-to-domain mapping, DID resolution helpers, and method-specific conversion logic.               |
| `packages/api`            | `@midnight-ntwrk/midnight-did-api`            | Runtime orchestration for wallets, providers, contracts, network profiles, and DID operations.        |
| `docs-site`               | `docs-site`                                   | VitePress documentation site for DID-owned packages and specifications.                               |

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

Current key-storage model:

- Ed25519, X25519, P-256, secp256k1, BLS12381G1, and BLS12381G2 `publicKeyJwk` material is stored as opaque canonical strings in `verificationMethods`.
- BLS12-381 JWK keys are OKP compressed public keys (`x` only): 48 bytes for G1 and 96 bytes for G2.
- `publicKeyMultibase` / `Multikey` is not a current ledger profile; add it through an explicit storage/API path if future W3C Data Integrity suites require it.
- SchnorrJubjub keys are stored as native `JubjubPoint` values in `schnorrJubjubVerificationMethods`.
- Resolver/API code merges both maps into DID Document `verificationMethod` output.
- Do not store the same key in both maps; relation sets share the normalized method-id namespace.
- `verifySchnorrJubjubDigestSignature` must stay ledger-bound by method id so verification uses the key currently stored in DID state.
- The DID method spec's trusted proof server appendix documents the current controller-secret witness trust assumption.

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
- local runtime/test state such as `.midnight-db/`, `.midnight-test/`, and
  `midnight-level-db/`
- disposable historical top-level package/service shells created before the
  `packages/` layout

Generated outputs are build artifacts. Do not manually edit them. Use
`./run.sh clean-artifacts` when old root-level package or service shells remain
after refactors; in addition to the usual generated artifacts, the cleaner
deletes only disposable historical shells and preserves tracked or
non-disposable contents. When a historical shell is reported as tracked or
non-disposable, the cleaner preserves the whole shell, including generated
children such as `dist/`, so inspect and remove it manually if it is safe.

When changing Compact circuits:

1. Update the Compact source.
2. Run the package build that regenerates managed artifacts.
3. Run package tests that exercise the generated runtime.
4. Verify downstream imports still use package names rather than deep workspace-relative source paths.

For shared Schnorr changes, run:

```bash
pnpm --filter ./packages/contract test
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

## pnpm and Turbo Notes

This repository uses pnpm 10 with a strict workspace layout and Turbo for package-level orchestration. Do not reintroduce `package-lock.json`, `npm ci`, or npm workspace commands.

Practical rules from the 2026-05-26 migration:

- In CI, run `corepack enable` before `actions/setup-node` uses `cache: pnpm`; otherwise setup-node cannot find pnpm.
- Every package that imports a tool or runtime helper must declare it directly. Strict pnpm does not let package-local ESLint configs or Vitest setup files rely on root hoisting. Examples: `globals` for package-local `eslint.config.mjs`, and `protobufjs`/`long` for `packages/api/vitest.setup.ts`.
- `packages/api` must directly declare runtime dependencies it imports or exposes through its TypeScript build, including Midnight SDK packages, `@midnight-ntwrk/compact-js`, and `rxjs`.
- Rollup's optional native package repair cannot assume `rollup/dist/native.js` is root-resolvable under pnpm. Treat a non-root-resolvable Rollup install as a skip unless the native optional package name is actually present in the error.
- After manifest changes, refresh with `pnpm install --lockfile-only`, verify with `pnpm install --frozen-lockfile`, then run the focused lane and `./run.sh --light --strict`.

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
./run.sh artifact-status
./run.sh check-managed-artifacts
./run.sh integration-report
./run.sh integration-report-schema
./run.sh check-integration
```

Target catalog check:

```bash
pnpm run check:run-target-catalog
```

Lane scripts:

| Target          | Script          | Purpose                            |
| --------------- | --------------- | ---------------------------------- |
| `./run.sh core` | `./run-core.sh` | Core package lint/build/test path. |
| `./run.sh api`  | `./run-api.sh`  | DID API lane.                      |
| `./run.sh docs` | `./run-docs.sh` | Docs generation/build lane.        |

## NPM Scripts

Common root scripts:

```bash
pnpm run lint
pnpm run lint:core
pnpm run build:all
pnpm run typecheck:all
pnpm run test:all
pnpm run ci:core
pnpm run check:did-surface-discipline
pnpm run test:workspace-manifests
pnpm run check:workspace-manifests
pnpm run test:did-surface-discipline
pnpm run check:run-target-catalog
pnpm run test:integration-report
pnpm run check:managed-artifacts
pnpm run artifacts:status
pnpm run clean:artifacts
pnpm run report:integration
pnpm run report:integration:schema
pnpm run check:integration
pnpm run artifacts:pack
```

Package examples:

```bash
pnpm --filter ./packages/contract build
pnpm --filter ./packages/contract test:ci
pnpm --filter ./packages/domain build
pnpm --filter ./packages/domain test:ci
pnpm --filter ./packages/did build
pnpm --filter ./packages/did test:ci
pnpm --filter ./packages/api build
pnpm --filter ./packages/api test:ci
pnpm --filter ./packages/api typecheck:examples
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
pnpm run artifacts:pack
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

The five DID packages are publishable to GitHub Packages. Keep the root
workspace and `docs-site` private, and keep package `publishConfig.registry`
pointing at `https://npm.pkg.github.com`. Publication order is owned by
`scripts/did-workspace-catalog.mjs --publish-workspaces`.

Release CI publishes snapshot versions from `main` and `develop`, RC versions
from `main` or `develop`, and final releases from `main` only. ZK artifacts are
distributed as a separate validated archive with the provider layout
`keys/*.prover`, `keys/*.verifier`, and `zkir/*.bzkir`; do not rely on package
consumers to discover proving keys by walking arbitrary generated directories.
Publish CI smoke-tests the exact package version from GitHub Packages and
fetches pulled/downloaded ZK bundles through `FetchZkConfigProvider`.

## CI Shape

GitHub Actions target `main` and `develop`.

Main jobs:

- `Core (Lint + Contract/Domain/DID)`: core package validation.
- `API pipeline`: API integration and example validation.
- `Build, Lint, Test, and Coverage`: aggregate CI gate for `core` and `api`.
- `Build Docs Site`: docs-site build.
- `Deploy Docs Site`: GitHub Pages deployment from `develop` pushes only.
- `Scan / build`: security scanning.
- `Check PR`: semantic PR title and non-empty PR body checks.

## Docs

Docs entry points:

- `README.md`: repository overview and command matrix.
- `docs-site/guide/local-development.md`: local development guide.
- `docs-site/guide/github-pages.md`: GitHub Pages publishing guide.
- `docs-site/guide/testing-strategy.md`: testing strategy.
- `docs-site/guide/did-surface-change-discipline.md`: discipline for DID surface changes.
- `docs-site/spec/midnight-method.md`: method specification material.
- `docs-site/spec/midnight-did-traits.md`: method traits.

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
