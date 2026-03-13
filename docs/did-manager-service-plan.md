# DID Manager Service Plan (Web App + Node.js Backend)

## Goal
Build a single-user demo web application that manages the full Midnight DID lifecycle for:
- `standalone`
- `preprod`

The app provides a minimal Midnight-style UI and a Node.js backend API.

## Product Decisions

- New component: `did-manager-service` (separate from resolver)
- Deployment mode (v1): single-user local demo
- Secret/key storage: backend file-based encrypted store
- Session persistence: backend file-based state
- Seed handling: support both generated and user-provided seeds
- Dev UX: remember unlocked session mode

## Architecture

```mermaid
graph TD
  Browser[Web UI]
  Backend[DID Manager Service]
  Session[(Session file)]
  Secrets[(Encrypted secret store)]
  CliApi[CliDidService]
  Api[@midnight-ntwrk/midnight-did-api]
  Chain[(Midnight Node)]
  Indexer[(Indexer)]
  Proof[(Proof Server)]

  Browser --> Backend
  Backend --> Session
  Backend --> Secrets
  Backend --> CliApi
  CliApi --> Api
  Api --> Chain
  Api --> Indexer
  Api --> Proof
```

## Backend API (v1)

### Session
- `GET /api/session` - session status and active profile/DID
- `POST /api/session/unlock` - unlock/start wallet+providers
- `POST /api/session/lock` - stop wallet and lock runtime context
- `POST /api/session/preferences` - update remember-unlocked preference

### DID lifecycle
- `POST /api/did/deploy`
- `POST /api/did/join`
- `GET /api/did/state`
- `GET /api/did/document`
- `POST /api/did/deactivate`

### Keys
- `GET /api/keys`
- `POST /api/keys/generate`
- `POST /api/keys/import`
- `DELETE /api/keys/:keyRef`

### DID updates
- `POST /api/did/verification-methods`
- `PUT /api/did/verification-methods/:methodId`
- `DELETE /api/did/verification-methods/:methodId`
- `POST /api/did/relations`
- `DELETE /api/did/relations`
- `POST /api/did/services`
- `PUT /api/did/services/:id`
- `DELETE /api/did/services/:id`
- `POST /api/did/also-known-as`
- `DELETE /api/did/also-known-as`

## Session Persistence Model

```json
{
  "version": 1,
  "rememberUnlockedSession": true,
  "lastProfile": "standalone",
  "profiles": {
    "standalone": {
      "seed": "...",
      "contractAddress": "...",
      "updatedAt": "..."
    },
    "preprod": {
      "seed": "...",
      "contractAddress": "...",
      "updatedAt": "..."
    }
  }
}
```

## UI Scope (v1)

- Session bootstrap card (profile + seed mode + unlock)
- DID summary card (status/version/timestamps)
- Operations forms (methods, relations, services, aliases, deactivate)
- Keys table + generate/import
- Raw DID document JSON viewer

## Phases

1. Scaffold workspace package (`did-manager-service`)
2. Implement backend session runtime + persistence
3. Implement DID/key APIs
4. Add minimal static UI shell
5. Add unit tests and run target
6. Iterate UI styling and UX hints

## Acceptance Criteria

- User can generate or reuse seed and unlock session.
- User can deploy/join DID and perform all DID operations via web API.
- User can restart backend and resume from persisted seed + contract context.
- Works for standalone and preprod profiles.
