# Local Development

## Prerequisites

- Node.js 24 and npm 10.
- Midnight Compact compiler `0.30.0`.
- Docker for API integration tests.

## Setup

```bash
npm ci
compact update 0.30.0
```

## Repository Layout

| Path                       | Responsibility                                               |
| -------------------------- | ------------------------------------------------------------ |
| `packages/contract/`       | Compact DID contract and generated runtime package.          |
| `packages/jubjub-schnorr/` | Shared Compact/TypeScript Schnorr helpers.                   |
| `packages/domain/`         | DID document/domain schemas and validation.                  |
| `packages/did/`            | Ledger-to-domain mapping and DID helpers.                    |
| `packages/api/`            | Wallet/provider/contract orchestration and network profiles. |
| `docs-site/`               | VitePress docs and generated API reference.                  |

Resolver service, DID manager, and secret-storage validation moved to
[`midnight-did-resolver`](https://github.com/midnightntwrk/midnight-did-resolver).
Credential and Passport work lives in the VC and solution-example repositories.
See [Repository Boundaries](/guide/repository-boundaries) before adding new
cross-repository docs or scripts.

## Validation

Local PR validation:

```bash
./run.sh --light --strict
```

`npm run ci` runs the same command. Use `npm run ci:packages` only when you need the legacy package-only lint/build/test lane.

Focused lanes:

```bash
./run.sh targets
./run.sh core --strict
./run.sh api --light --strict
./run.sh docs
```

Metrics:

```bash
./run.sh --light --strict --metrics --metrics-json /tmp/midnight-did-run.json
```

Surface and integration guards:

```bash
npm run check:did-surface-discipline
npm run check:run-target-catalog
npm run check:integration
```

## Full Local Loop

Use the full loop for API/provider/runtime changes that need Docker-backed integration coverage.

```bash
PROOF_SERVER_IMAGE=proof-server-bootstrap:8.0.3 ./run.sh --strict
```

## Local Artifacts

```bash
npm run artifacts:pack
```

This writes local tarballs under `artifacts/npm/` for the DID packages owned by this repository.

## Running This Docs Site

From the repository root:

```bash
./start-docs.sh
```

Default local URL:

- `http://127.0.0.1:4173`

Production build:

```bash
npm run docs:build
```

Run the full docs pipeline:

```bash
./run.sh docs
```

Preview the built site:

```bash
npm run docs:preview
```

If you are checking GitHub Pages-specific behavior locally, you can override the base path:

```bash
DOCS_BASE=/midnight-did/ npm run docs:build
```

Generate API reference only:

```bash
npm run docs:api
```

Sync mirrored source markdown into the docs site:

```bash
npm run docs:sync-source
```

## Important Repository Paths

| Path              | Purpose                                                               |
| ----------------- | --------------------------------------------------------------------- |
| `contract/`       | Compact contract and contract-focused tests.                          |
| `domain/`         | DID schemas and normalization rules.                                  |
| `did/`            | Ledger-to-domain mapping and resolver helpers.                        |
| `api/`            | Runtime orchestration over node, indexer, proof server, and contract. |
| `jubjub-schnorr/` | Shared Schnorr Compact and TypeScript helpers.                        |
| `docs-site/`      | Documentation site and generated API reference.                       |
