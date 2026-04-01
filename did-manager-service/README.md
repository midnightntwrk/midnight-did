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

- runtime setup is backend-controlled: `standalone` or `preprod`
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
9. Move to `/did` and deploy or join a DID contract.

For preprod faucet funding:
- `https://faucet.preprod.midnight.network/`

## Main env vars

- `DID_MANAGER_HOST` (default `127.0.0.1`)
- `DID_MANAGER_PORT` (default `3010`)
- `DID_MANAGER_DATA_DIR` (default `~/.midnight-did`)
- `DID_MANAGER_SESSION_FILE`
- `DID_MANAGER_SECRET_FILE`
- `DID_MANAGER_SECRET_PASSPHRASE`
- `DID_MANAGER_REMEMBER_UNLOCKED` (`true|false`)
- `DID_MANAGER_SETUP` (`standalone|preprod`)
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
