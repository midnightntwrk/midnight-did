# @midnight-ntwrk/midnight-did-manager-service

Single-user web backend + minimal UI for managing Midnight DID lifecycle operations.

## Responsibilities

- Prepare a Midnight wallet funding address from a shared seed
- Persist local profiles and per-profile DID state
- Unlock the wallet/runtime and execute DID lifecycle operations
- Manage verification methods, relations, services, aliases, and deactivation
- Expose a browser UI and a service API over the same orchestration layer

## UI Structure

- `/wallet`
  - setup notice
  - local profile selection
  - seed handling
  - funding preparation
  - NIGHT / tNIGHT and DUST balance visibility
  - unlock/session state
- `/secret-storage`
  - local key generation
  - key import and deletion
  - key inventory
- `/did`
  - deploy/join DID contract
  - update DID state
  - inspect current DID document and metadata

## Data Model

- runtime setup is backend-controlled: `standalone`, `preprod`, or `mainnet`
- local profiles are user-selectable inside the configured setup
- seed modes:
  - `reuse`
  - `provided`
  - `generated`
- default secret backend:
  - encrypted file store via `secret-storage`

Persisted state includes:

- shared seed
- funding address
- known contract addresses
- current joined/deployed contract
- profile-specific Midnight private-state storage

## Run

- Dev: `npm run dev -w did-manager-service`
- Build: `npm run build -w did-manager-service`
- Start: `npm run start -w did-manager-service`
- Test: `npm run test -w did-manager-service`
- Playwright: `npm run test:e2e -w did-manager-service`
- Playwright standalone: `npm run test:e2e:standalone -w did-manager-service`
- Playwright preprod funding: `npm run test:e2e:preprod -w did-manager-service`

Open:
- UI: `http://127.0.0.1:3010/`
- API docs: `http://127.0.0.1:3010/docs`

Helpers:
- `./start-manager.sh`
- `./start-manager.sh --standalone`
- `./start-manager.sh --preprod`
- `./start-manager.sh --mainnet`

Shared infrastructure:
- preprod proof server compose: `infrastructure/preprod-proof-server.yml`

## Preprod flow

1. Start `./start-manager.sh --preprod`.
2. Open `/wallet`.
3. Choose a seed mode:
   - `reuse` to use a previously stored seed
   - `provided` to paste an existing seed
   - `generated` to create a new seed for funding
4. Click `Prepare funding`.
5. Copy the `Prepared funding address` from the UI.
6. If the response includes `generatedSeed`, keep it and reuse it for unlock. The UI copies it into the seed field, switches the mode to `provided`, and stores the shared seed + wallet address in the manager session file.
7. Top up the address with `tNight`.
8. After funds arrive, click `Unlock`.
9. Confirm the wallet balances are visible on the wallet page:
   - `NIGHT / tNIGHT`
   - `DUST`
10. Move to `/did` and deploy or join a DID contract.

For preprod faucet funding:
- `https://faucet.preprod.midnight.network/`

Mainnet note:
- `--mainnet` requires explicit `DID_MANAGER_MAINNET_INDEXER`, `DID_MANAGER_MAINNET_INDEXER_WS`, `DID_MANAGER_MAINNET_NODE`, and `DID_MANAGER_MAINNET_PROOF_SERVER` values. No defaults are hard-coded.

## Local data directory (`~/.midnight-did`)

Default manager storage root:

- `~/.midnight-did` (override with `DID_MANAGER_DATA_DIR`)

Structure (simplified):

```text
~/.midnight-did/
├─ did-manager-service.log
├─ manager-profiles.json
├─ profiles/<network>/<profile>/
│  ├─ manager-session.json
│  ├─ manager-secrets.json
│  ├─ wallet-state/<seedHash6>/
│  └─ midnight-level-db/<seedHash16>/
└─ backup/wallet-state/<network>/<profile>/<timestamp>/
```

Stored data:

- profile/session metadata (seed presence, funding address, contract addresses)
- encrypted secret-store data (`manager-secrets.json`)
- persisted wallet snapshots for reusable networks
- Midnight private state DB scoped by network/profile/seed
- migration/restore backups of wallet snapshots

Treat this directory as sensitive local state and do not commit it.

## Main env vars

- `DID_MANAGER_HOST` (default `127.0.0.1`)
- `DID_MANAGER_PORT` (default `3010`)
- `DID_MANAGER_DATA_DIR` (default `~/.midnight-did`)
- `DID_MANAGER_SESSION_FILE`
- `DID_MANAGER_SECRET_FILE`
- `DID_MANAGER_SECRET_PASSPHRASE`
- `DID_MANAGER_REMEMBER_UNLOCKED` (`true|false`)
- `DID_MANAGER_SETUP` (`standalone|preprod|mainnet`)
- `DID_MANAGER_LOG_FILE`

## Main Source Files

- `src/index.ts`
- `src/app.ts`
- `src/manager.ts`
- `src/manager/`
- `src/http/`
- `src/ui/`
- `src/wallet-state-store.ts`

## Related docs

- docs site service page:
  - `/services/did-manager-service`
- docs site architecture page:
  - `/architecture/did-manager-service`
