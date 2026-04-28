# Local Development

## Prerequisites

- Node.js 24+
- npm 10+
- Docker for integration flows
- Compact compiler `0.5.1`
- Compact toolchain `0.30.0` (`compact update 0.30.0`)

## Main workspace commands

Fast verification:

```bash
SKIP_LONG_RUNNING=1 ./run.sh
```

This root runner now validates only the Midnight DID workspace:

- core packages
- API
- resolver
- DID manager

CI-aligned core verification (skip auto-fix pass):

```bash
SKIP_LINT_FIX=1 ./run-core.sh
```

Targeted runners:

```bash
./run-api.sh
./run-resolver.sh
./run-manager.sh
./start-resolver.sh
./start-manager.sh
```

Preprod helpers:

```bash
./start-resolver.sh --preprod
./start-manager.sh --preprod
```

Mainnet launchers use sane defaults and can be overridden if needed:

```bash
./start-resolver.sh --mainnet

./start-manager.sh --mainnet
```

Resolver defaults:
- `MIDNIGHT_INDEXER_HTTP_URL=https://indexer.mainnet.midnight.network/api/v4/graphql`
- `MIDNIGHT_INDEXER_WS_URL=wss://indexer.mainnet.midnight.network/api/v4/graphql/ws`

Manager defaults:
- `DID_MANAGER_MAINNET_INDEXER=https://indexer.mainnet.midnight.network/api/v4/graphql`
- `DID_MANAGER_MAINNET_INDEXER_WS=wss://indexer.mainnet.midnight.network/api/v4/graphql/ws`
- `DID_MANAGER_MAINNET_NODE=https://rpc.mainnet.midnight.network`
- `DID_MANAGER_MAINNET_PROOF_SERVER=http://127.0.0.1:6300` (local)

Mainnet note:
- no faucet is shown in Wallet Setup
- use the same seed as a funded Midnight Wallet

Shared runtime infrastructure:

- standalone stack: `api/standalone.yml`
- preprod proof server: `infrastructure/preprod-proof-server.yml`

## Midnight Credentials and Passport prototype

Credential and Passport work now live in split repositories:

- reusable credential capability packages:
  `research/identity-examples/midnight-verifiable-credentials`
- Passport-product prototype packages:
  `research/identity-examples/midnight-identity-solution-examples`

Use the broader credentials runner when changing the Compact credential model,
credential families, standalone integration tests, or the Passport prototype:

```bash
cd research/identity-examples/midnight-verifiable-credentials
PROOF_SERVER_IMAGE=proof-server-bootstrap:8.0.3 ./run.sh
```

Use the Passport runner when iterating on the Lace Wallet + Midnight Passport
prototype only:

```bash
cd research/identity-examples/midnight-identity-solution-examples
PROOF_SERVER_IMAGE=proof-server-bootstrap:8.0.3 ./run.sh
```

Root compatibility wrappers still exist:

```bash
PROOF_SERVER_IMAGE=proof-server-bootstrap:8.0.3 ./run-credentials.sh
PROOF_SERVER_IMAGE=proof-server-bootstrap:8.0.3 ./run-passport-prototype.sh
```

This runner validates:

- Passport-specific credential package lint/build/tests
- `credentials-openid` build and tests
- the TypeScript browser-session backend
- Playwright browser flow through the Digital National ID and Screening issuer
  redirects
- standalone explicit and hidden-holder Passport credential integrations when Docker is available

Start the browser prototype:

```bash
./start-passport-prototype.sh
```

Default local URL:

- `http://127.0.0.1:5174`

The prototype is not just a static page. It uses the TypeScript server in
`midnight-passport-prototype/src/serve-app.ts`, with actors for the wallet,
Digital National ID issuer, Screening VC issuer, DApp, verifier contract stub,
and external crypto wallet stub.

The Digital National ID issuer flow intentionally mocks document upload,
liveness, and profile approval checks while keeping the protocol exchange close
to the target shape:

1. wallet starts issuer session
2. browser redirects to `national-id-issuer.html`
3. user completes mocked checks
4. issuer redirects back with `credential_offer_uri`, `issuer_session`, and `state`
5. wallet validates callback state/session
6. wallet exchanges pre-authorized token and credential request messages
7. wallet stores the Midnight Compact credential response

The Screening VC issuer follows the same redirect and offer redemption pattern,
but starts only after the wallet holds the National ID credential:

1. wallet starts screening issuer session
2. browser redirects to `screening-issuer.html`
3. user completes mocked National-ID-verification, sanctions, PEP, and approval
   checks
4. issuer redirects back with `credential_offer_uri`, `issuer_session`,
   `issuer_kind=screening`, and `state`
5. wallet validates callback state/session
6. wallet exchanges pre-authorized token and credential request messages
7. wallet stores the Midnight Compact Screening VC response
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
- CI service jobs (when repository variable `PROOF_SERVER_IMAGE` is set)

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
| `profiles/<network>/<profile>/manager-session.json` | profile session state | includes seed, unshielded address, known/current contract addresses, remember-started-session preference |
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

## GitHub Actions CI topology

The CI workflow is split to reduce wall-clock time:

1. `core` job: lint, contract/domain/did/secret-storage build/tests/coverage
2. `services` matrix: `run-api.sh`, `run-resolver.sh`, and `run-manager.sh` in parallel
3. final aggregation job that fails if any dependency job fails

Performance behavior:

- npm package cache is enabled through `actions/setup-node`
- Compact toolchain is cached via `setup-compact-action`
- Playwright browser binaries are cached for manager e2e
- manager runner prepares shared dependencies once, then runs build/test without repeating `prepare:deps`
- service runners guard against missing generated managed contract artifacts in clean CI checkouts

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
