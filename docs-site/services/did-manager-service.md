# DID Manager Service

The DID manager is a single-user Node.js web application for wallet preparation and Midnight DID lifecycle operations.

## Scope

- prepare funding using the same shared seed used for DID ownership
- unlock and persist local profiles
- manage local secret storage independently from DID publication
- deploy or join a DID contract
- manage verification methods, relations, services, aliases, and deactivation

## Main pages

- `/wallet`
- `/secret-storage`
- `/did`
- `/docs`

## User flow

```mermaid
stateDiagram-v2
  [*] --> Wallet
  Wallet --> FundingPrepared : prepare funding
  FundingPrepared --> Unlocked : unlock
  Unlocked --> SecretStorage : open /secret-storage
  Unlocked --> DidPage : open /did
  SecretStorage --> DidPage : select local key for DID operation
  DidPage --> DidPage : deploy/join/update
  DidPage --> Deactivated : deactivate
```

## Main configuration

| Variable | Purpose |
|---|---|
| `DID_MANAGER_SETUP` | Runtime setup: `standalone` or `preprod` |
| `DID_MANAGER_HOST` | Bind host |
| `DID_MANAGER_PORT` | Bind port |
| `DID_MANAGER_DATA_DIR` | Persistent local data directory |
| `DID_MANAGER_SESSION_FILE` | Optional explicit session file path |
| `DID_MANAGER_SECRET_FILE` | Optional explicit secret store file path |
| `DID_MANAGER_SECRET_PASSPHRASE` | Secret store passphrase |
| `DID_MANAGER_LOG_FILE` | Log output file |

## Run

```bash
npm run dev -w did-manager-service
./start-manager.sh
./start-manager.sh --preprod
```

## Main repository paths

- `did-manager-service/src/index.ts`
- `did-manager-service/src/app.ts`
- `did-manager-service/src/manager.ts`
- `did-manager-service/src/manager/`
- `did-manager-service/src/http/`
- `did-manager-service/src/ui/`
- `did-manager-service/README.md`

## Architecture

- [DID Manager Architecture](/architecture/did-manager-service)
- [ADR: Shared Seed and Local Profiles](/architecture/adr-shared-seed-and-profiles)
- [ADR: Resolver vs Manager Service Split](/architecture/adr-service-split)

## Full source doc

- [Embedded Manager README](/source/did-manager-service-readme)
