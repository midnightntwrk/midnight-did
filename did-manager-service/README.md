# @midnight-ntwrk/midnight-did-manager-service

Single-user web backend + minimal UI for managing Midnight DID lifecycle operations.

## Scope (v1)

- Profiles: `standalone`, `preprod`
- Seed modes: `reuse`, `provided`, `generated`
- Backend encrypted secret store (file)
- Session persistence (seed + active contract)

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

## Preprod flow

1. Select `preprod`.
2. Choose a seed mode:
   - `reuse` to use a previously stored seed
   - `provided` to paste an existing seed
   - `generated` to create a new seed for funding
3. Click `Prepare funding`.
4. Copy the `Prepared funding address` from the UI.
5. If the response includes `generatedSeed`, keep it and reuse it for unlock. The UI copies it into the seed field, switches the mode to `provided`, and stores the shared seed + wallet address in the manager session file.
6. Top up the address with `tNight`.
7. After funds arrive, click `Unlock`.

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
