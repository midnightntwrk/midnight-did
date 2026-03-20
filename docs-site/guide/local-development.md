# Local Development

## Prerequisites

- Node.js 24+
- npm 10+
- Docker for integration flows

## Main workspace commands

Fast verification:

```bash
SKIP_LONG_RUNNING=1 ./run.sh
```

Targeted runners:

```bash
./run-api.sh
./run-cli.sh
./run-resolver.sh
./run-manager.sh
```

Preprod helpers:

```bash
./run-resolver-preprod.sh
./run-manager-preprod.sh
```

## Developer workflow

For quick verification, start with the fast pipeline:

```bash
SKIP_LONG_RUNNING=1 ./run.sh
```

Then run the specific component you are changing:

- `./run-api.sh`
- `./run-cli.sh`
- `./run-resolver.sh`
- `./run-manager.sh`

Use the preprod helpers only when you are intentionally exercising preprod-specific flows such as funding and long-lived profiles.

## Running this docs site

From the repository root:

```bash
npm install
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
./run-docs.sh
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

## Important repository paths

| Path | Purpose |
|---|---|
| `contract/` | Compact contract and contract-focused tests |
| `domain/` | DID schemas and normalization rules |
| `did/` | Ledger-to-domain mapping and resolver helpers |
| `api/` | Runtime orchestration over node, indexer, proof server, and contract |
| `secret-storage/` | Reusable encrypted key storage and HD derivation |
| `cli/` | Shell-facing application flow and state machine |
| `did-resolver-service/` | Resolver HTTP service and UI |
| `did-manager-service/` | Wallet/DID management HTTP service and UI |
