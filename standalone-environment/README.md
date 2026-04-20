# `standalone-environment`

Shared Midnight standalone integration harness for the credentials prototype.

## Purpose

This package centralizes the Docker-backed environment used by credentials
integration tests:

- starts the standalone Midnight stack from `api/standalone.yml`
- builds and funds a wallet from the dev genesis seed
- configures API providers against mapped Docker ports
- provisions real Midnight DID profiles for issuer, holder, and verifier roles
- tears the environment down cleanly after tests

It exists so package-level integration tests do not each reinvent:

- Docker lifecycle handling
- wallet sync and funding waits
- dust generation registration
- DID deployment and verification method publishing

## What It Exports

- `StandaloneEnvironment`
- `provisionDidProfile(...)`
- `containerRuntimeAvailable()`
- `verifierChallengeForProfile(...)`
- `TIMEOUTS`

## Current Consumers

- `credentials-demo-contract/src/test/integration/`
- `credentials-protocol/src/test/integration/`

## Validation

```sh
npm run typecheck -w standalone-environment
```

Integration execution happens through the consuming packages:

```sh
npm run test:integration -w credentials-demo-contract
npm run test:integration -w credentials-protocol
```
