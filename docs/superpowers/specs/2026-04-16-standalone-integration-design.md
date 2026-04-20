# Standalone Integration Tests Design

Date: 2026-04-16

Status: Approved

## Context

The `credentials-protocol` package has 21 simulator-based tests that prove the protocol logic works with real Compact circuit assertions but synthetic DID profiles. The next step is integration tests that exercise the full stack against real Midnight infrastructure: blockchain node, indexer, proof server, and on-chain DID contracts.

The existing `StandaloneProtocolEnvironment` skeleton in `credentials-demo-contract/src/test/integration/` handles Docker orchestration and DID provisioning but is coupled to one package. The Midnight standalone environment is genuinely reusable infrastructure that should be shared.

## Delivery Scope

### In scope

1. Extract `StandaloneProtocolEnvironment` into a new `standalone-environment` shared package
2. Migrate `credentials-demo-contract/src/test/integration/` to import from the shared package
3. Write integration tests in `credentials-protocol/src/test/integration/` covering explicit-holder, secret-holder, and contract-verifier lifecycle flows
4. All integration tests gated behind container runtime availability

### Out of scope

- Migrating `did-resolver-service` integration tests to use the shared package (future)
- OID4VCI / OID4VP protocol bindings
- New Docker compose files (reuse existing `api/standalone.yml`)

## Architecture

### Package: `standalone-environment`

A new workspace package that owns the shared Midnight standalone infrastructure.

```
standalone-environment/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── standalone-config.ts          — network config (node, indexer, proof-server URLs)
│   ├── standalone-environment.ts     — Docker lifecycle, wallet setup, service health
│   ├── did-profile.ts               — DID provisioning (deploy, add methods, resolve)
│   ├── wallet-setup.ts              — wallet creation, funding, dust registration
│   └── docker-utils.ts              — compose up/down, port mapping, health polling
```

#### Source material

The implementation is extracted from:
- `credentials-demo-contract/src/test/integration/standalone-protocol-environment.ts` — the existing skeleton with Docker lifecycle, wallet setup, DID provisioning, and cleanup
- `did-resolver-service/src/test/integration/docker-compose-utils.ts` — compose up/down utilities, port mapping, health polling

The extraction should:
- Preserve the existing retry logic (3 attempts with 8s delay for dust errors)
- Preserve timeout constants (180s wallet sync, 300s dust generation, 90s service startup)
- Preserve the `ProtocolDidProfile` type and `provisionDidProfile` workflow
- Make the compose file path configurable (default: `api/standalone.yml`)

#### Dependencies

```
standalone-environment
├── @midnight-ntwrk/compact-runtime
├── @midnight-ntwrk/midnight-did-api        (wallet, providers, DID operations)
├── @midnight-ntwrk/midnight-did-domain     (DID document types)
├── @midnight-ntwrk/midnight-did-contract   (contract deployment)
└── @midnight-ntwrk/midnight-did            (DID operations, resolution)
```

#### Exported API

```typescript
// Lifecycle
export class StandaloneEnvironment {
  start(): Promise<MidnightDIDProviders>;
  shutdown(): Promise<void>;
  waitForWalletSync(): Promise<void>;
}

// DID provisioning
export type ProtocolDidProfile = {
  readonly role: PartyRole;
  readonly didString: string;
  readonly contractAddress: string;
  readonly contract: DeployedMidnightDIDContract;
  readonly verificationMethodRef: string;
  readonly verificationMethodRefValue: VerificationMethodRef;
};

export function provisionDidProfile(
  environment: StandaloneEnvironment,
  role: PartyRole,
  signer: Signer,
): Promise<ProtocolDidProfile>;

// Utilities
export function containerRuntimeAvailable(): boolean;
export function verifierChallengeForProfile(didString: string, purpose: string): Uint8Array;
```

### Integration Tests: `credentials-protocol/src/test/integration/`

```
credentials-protocol/src/test/integration/
├── explicit-holder-lifecycle.integration.test.ts
├── secret-holder-lifecycle.integration.test.ts
└── contract-verifier-lifecycle.integration.test.ts
```

#### Test setup pattern

Every integration test file:
1. Checks `containerRuntimeAvailable()` — skips if no Docker
2. `beforeAll` (10-min timeout): start `StandaloneEnvironment`, provision DID profiles
3. Tests: run protocol flows using real DID profiles
4. `afterAll` (5-min timeout): shutdown and cleanup

#### Test scenarios

**explicit-holder-lifecycle.integration.test.ts:**

| Test | What it proves |
|------|---------------|
| Issue + present + verify with real DIDs | Compact circuits execute against proof server, DID verification methods work end-to-end |
| Age predicate with real infrastructure | ZK age proof passes with real proof generation |

Parties provisioned: issuer DID, holder DID, verifier DID (3 DID contracts deployed)

**secret-holder-lifecycle.integration.test.ts:**

| Test | What it proves |
|------|---------------|
| Secret-holder issuance with real issuer DID | Blinded holder binding works with on-chain issuer verification method |
| Presentation with verifier pseudonym | Pseudonym derivation works in the real stack |

Parties provisioned: issuer DID only (holder has no DID — uses hidden secret)

**contract-verifier-lifecycle.integration.test.ts:**

| Test | What it proves |
|------|---------------|
| Full age-gate lifecycle with real contract deployment | Demo contract deploys, issues credential, verifies presentation, mints capability — all with real ZK proofs |

Parties provisioned: issuer DID, holder DID (demo contract deployed as the verifier)

#### Connection to protocol agents

The integration tests use the same `IssuerAgent`, `HolderAgent`, `SecretIssuerAgent`, `SecretHolderAgent`, `VerifierAgent`, and `ContractVerifier` classes from `credentials-protocol/src/agents/`. The only difference is the `DIDProfile` values come from the shared `provisionDidProfile(env.providers, ...)` helper in `standalone-environment` instead of the simulated `createDIDProfile()`.

This is the "simulated vs real DID" seam that was designed into the architecture from the start.

#### Skip and run configuration

Integration tests are excluded from `npm run test` via vitest config:
```typescript
// credentials-protocol/vitest.config.ts
exclude: ["src/test/integration/**/*.test.ts"]
```

Run separately via:
```bash
npm run test:integration --workspace=credentials-protocol
```

### Migration: `credentials-demo-contract/src/test/integration/`

The existing `standalone-protocol-environment.ts` and `issuance-verification.integration.test.ts` were updated to import from `standalone-environment` instead of defining their own environment class. This validates the extraction works correctly.

## Docker Infrastructure

No new Docker compose files. All integration tests use `api/standalone.yml` which provides:
- `midnight-node` (blockchain, port 9944)
- `did-indexer` (GraphQL, port 8088)
- `did-proof-server` (ZK proofs, port 6300)

Port mapping is dynamic (Docker assigns host ports, tests discover them).

## Timeouts

| Operation | Timeout |
|-----------|---------|
| Docker services startup | 180s |
| Wallet sync | 180s |
| Wallet funding | 180s |
| Dust generation registration | 300s |
| DID creation (with retry) | 3 attempts, 8s between |
| Single integration test | 600s (10 min) |
| beforeAll setup | 600s |
| afterAll cleanup | 300s |

## Design Decisions

### Why extract instead of duplicate

The standalone environment involves ~300 lines of Docker orchestration, wallet setup, retry logic, and cleanup. Duplicating it across packages creates maintenance burden and divergence risk. A shared package ensures consistent behavior.

### Why not move the existing integration test

The `credentials-demo-contract` integration test skeleton validates the demo contract specifically. It should continue to exist for that purpose. The new `credentials-protocol` integration tests validate the protocol layer across all profiles. Both import from the same shared environment.

### Why one environment instance per test file

DID provisioning is expensive (contract deployment, verification method registration, wallet sync). Sharing one environment across tests within a file amortizes the setup cost. Separate test files get separate environments to avoid cross-contamination.

### Why the contract-verifier test is separate

The contract-verifier integration test requires deploying the demo Compact contract through the proof server — a qualitatively different operation from the protocol-only tests. It exercises the real ZK proof pipeline, which is the highest-value integration test.
