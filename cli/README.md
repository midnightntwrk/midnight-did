# @midnight-ntwrk/midnight-did-cli

Interactive and testable CLI for `did:midnight` lifecycle management.

## Responsibilities

- Shell UX (menus/prompts)
- CLI API service orchestration
- State-machine guardrails and next-step hints
- Key management through `secret-storage` (keyRef-first operations)

## Architecture

```mermaid
graph TD
  User[Human operator]
  Shell[Shell adapter]
  CliApi[CliDidService]
  Machine[State machine + hints]
  API[API package]
  Secrets[Secret storage]

  User --> Shell
  Shell --> CliApi
  CliApi --> Machine
  CliApi --> API
  CliApi --> Secrets
```

## CLI State Machine

```mermaid
stateDiagram-v2
  [*] --> NoContract
  NoContract --> DidActiveEmpty : deploy/join
  DidActiveEmpty --> DidActiveWithMethods : add verification method
  DidActiveWithMethods --> DidActiveWithRelations : add relation
  DidActiveWithMethods --> DidActiveWithServicesOrAliases : add service/alias
  DidActiveWithRelations --> DidActiveWithMethods : remove relation
  DidActiveWithServicesOrAliases --> DidActiveWithMethods : remove service/alias
  DidActiveWithMethods --> DidDeactivated : deactivate
  DidActiveWithRelations --> DidDeactivated : deactivate
  DidActiveWithServicesOrAliases --> DidDeactivated : deactivate
```

## Command Flow

```mermaid
sequenceDiagram
  participant User
  participant Shell
  participant Service as CliDidService
  participant API
  participant Secrets

  User->>Shell: add verification method from keyRef
  Shell->>Service: addVerificationMethodFromKey(...)
  Service->>Service: refresh state + check transition
  Service->>Secrets: getPublicKey(keyRef)
  Service->>API: addVerificationMethod(...)
  API-->>Service: result
  Service-->>Shell: result + next hints
  Shell-->>User: display output
```

## Key/Secret Handling

- Default backend: encrypted file store
- Optional backend: veramo adapter path
- Supported key curves:
  - Ed25519
  - P-256
  - Jubjub

Environment:
- `CLI_SECRET_BACKEND=file|veramo`
- `CLI_SECRET_FILE_PATH`
- `CLI_SECRET_PASSPHRASE`

## Build & Test

- Build: `npm run build -w cli`
- CLI API + secret-storage tests: `npm run test:cli-api -w cli`
- Full CLI tests (includes docker-backed tests): `npm run test-api -w cli`

## Notes

- `src/cli-api/*` contains business logic.
- `src/shell/*` contains terminal interaction only.
- This split keeps logic deterministic and easy to test.
