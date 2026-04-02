# Local Development

## Prerequisites

- Node.js 24+
- npm 10+
- Docker for integration flows
- Compact devtools `0.4.x`
- Compact toolchain `0.30.0` (`compact update 0.30.0`)

## Main workspace commands

Fast verification:

```bash
SKIP_LONG_RUNNING=1 ./run.sh
```

Targeted runners:

```bash
./run-api.sh
./start-resolver.sh
./start-manager.sh
```

Preprod helpers:

```bash
./start-resolver.sh --preprod
./start-manager.sh --preprod
```

Mainnet launchers require explicit env vars:

```bash
MIDNIGHT_INDEXER_HTTP_URL=https://... \
MIDNIGHT_INDEXER_WS_URL=wss://... \
./start-resolver.sh --mainnet

DID_MANAGER_MAINNET_INDEXER=https://... \
DID_MANAGER_MAINNET_INDEXER_WS=wss://... \
DID_MANAGER_MAINNET_NODE=https://... \
DID_MANAGER_MAINNET_PROOF_SERVER=https://... \
./start-manager.sh --mainnet
```

Shared runtime infrastructure:

- standalone stack: `api/standalone.yml`
- preprod proof server: `infrastructure/preprod-proof-server.yml`

## Bootstrapped proof server image (local optimization)

### Purpose

Proof server cold start can be slow because startup downloads proving resources.
A bootstrapped image preloads those resources so local startup is faster and more stable.

### Build the local bootstrapped image

```bash
python3 proof-server-bootstrap/bootstrap.py
```

Expected local tag:

- `proof-server-bootstrap:8.0.3`

### Use the bootstrapped image

Set this env var in your shell before running local Docker-based flows:

```bash
export PROOF_SERVER_IMAGE=proof-server-bootstrap:8.0.3
```

This env var is already consumed by:

- `api/standalone.yml`
- `api/standalone-latest.yml`
- `infrastructure/preprod-proof-server.yml`

### Revert to default image

```bash
unset PROOF_SERVER_IMAGE
```

## `~/.midnight-did` directory layout

By default, manager runtime data is stored under:

```text
~/.midnight-did/
```

You can override this with `DID_MANAGER_DATA_DIR`.

### Structure

```text
~/.midnight-did/
├─ did-manager-service.log
├─ manager-profiles.json
├─ profiles/
│  └─ <network>/                       # standalone | preprod | mainnet
│     └─ <profile-name>/
│        ├─ manager-session.json
│        ├─ manager-secrets.json
│        ├─ wallet-state/
│        │  └─ <seedHash6>/
│        │     ├─ meta.json
│        │     ├─ shielded.json
│        │     ├─ unshielded.json
│        │     ├─ dust.json
│        │     └─ unshielded-history.json
│        └─ midnight-level-db/
│           └─ <seedHash16>/           # private state DB for contract ops
└─ backup/
   └─ wallet-state/
      └─ <network>/<profile-name>/<timestamp>/
```

### What is stored here

| Path | Stored data | Notes |
|---|---|---|
| `did-manager-service.log` | service logs | defaults to this location unless `DID_MANAGER_LOG_FILE` is set |
| `manager-profiles.json` | selected profile per network + migration flags | profile index metadata |
| `profiles/<network>/<profile>/manager-session.json` | profile session state | includes seed, unshielded address, known/current contract addresses, remember-unlocked preference |
| `profiles/<network>/<profile>/manager-secrets.json` | encrypted local secret store | key metadata + encrypted private key material |
| `profiles/<network>/<profile>/wallet-state/<seedHash6>/...` | serialized wallet snapshot | used for fast restore on reusable networks (for example preprod) |
| `profiles/<network>/<profile>/midnight-level-db/<seedHash16>/` | Midnight private state DB | network/profile/seed-isolated private contract state |
| `backup/wallet-state/...` | auto-backups of wallet snapshots | used during migration/incompatible restore fallback |

### Security note

Treat `~/.midnight-did` as sensitive local state:

- it can contain seed-derived wallet/session data
- it can contain encrypted private key material
- it may reveal contract addresses and operational history

Avoid committing or sharing files from this directory.

## Developer workflow

For quick verification, start with the fast pipeline:

```bash
SKIP_LONG_RUNNING=1 ./run.sh
```

Then run the specific component you are changing:

- `./run-api.sh`
- `./start-resolver.sh`
- `./start-manager.sh`

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
| `did-resolver-service/` | Resolver HTTP service and UI |
| `did-manager-service/` | Wallet/DID management HTTP service and UI |
