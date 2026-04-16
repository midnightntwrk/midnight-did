# Standalone Integration Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the Midnight standalone environment into a shared package and write integration tests that exercise credential protocol flows with real provisioned Midnight DIDs.

**Architecture:** A new `standalone-environment` package extracts Docker orchestration, wallet setup, and DID provisioning from `credentials-demo-contract/src/test/integration/standalone-protocol-environment.ts` into a reusable workspace package. Integration tests in `credentials-protocol/src/test/integration/` import from this shared package and use the same protocol agents as the simulator tests, but with real DID profiles from on-chain contracts.

**Tech Stack:** TypeScript, Vitest, testcontainers (Docker orchestration), Midnight SDK (`@midnight-ntwrk/*` packages), Compact pureCircuits

**Spec:** `docs/superpowers/specs/2026-04-16-standalone-integration-design.md`

---

## File Structure

```
standalone-environment/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                       — public exports
│   ├── standalone-config.ts           — compose path, timeout constants, network config
│   ├── standalone-environment.ts      — Docker lifecycle, wallet setup, provider configuration
│   ├── did-profile.ts                — DID provisioning with retry logic
│   ├── wallet-setup.ts              — wallet creation, funding, dust registration  
│   └── docker-utils.ts              — container runtime check, port mapping, timeout helper

credentials-protocol/
├── vitest.integration.config.ts       — vitest config for integration tests only
├── src/test/integration/
│   ├── explicit-holder-lifecycle.integration.test.ts
│   ├── secret-holder-lifecycle.integration.test.ts
│   └── contract-verifier-lifecycle.integration.test.ts
```

---

## Task 1: Scaffold `standalone-environment` package

**Files:**
- Create: `standalone-environment/package.json`
- Create: `standalone-environment/tsconfig.json`
- Modify: `package.json` (root — add workspace entry)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@midnight-ntwrk/midnight-did-standalone-environment",
  "version": "0.1.0",
  "description": "Shared Midnight standalone environment for integration tests",
  "type": "module",
  "main": "src/index.ts",
  "engines": {
    "node": ">=24",
    "npm": ">=10"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@midnight-ntwrk/compact-runtime": "*",
    "@midnight-ntwrk/midnight-did-api": "*",
    "@midnight-ntwrk/midnight-did-domain": "*",
    "@midnight-ntwrk/midnight-did-contract": "*",
    "@midnight-ntwrk/midnight-did": "*",
    "testcontainers": "*",
    "rxjs": "*"
  }
}
```

Note: This package is test infrastructure, not a published library — it exports TypeScript source directly (`"main": "src/index.ts"`), consumed via workspace references. No build step needed.

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 3: Add workspace entry to root package.json**

Add `"standalone-environment"` to the `workspaces` array in the root `package.json`, after `"credentials-protocol"`.

- [ ] **Step 4: Run npm install**

Run: `npm install`
Expected: clean install with standalone-environment linked in workspace

- [ ] **Step 5: Commit**

```bash
git add standalone-environment/package.json standalone-environment/tsconfig.json package.json
git commit -S -s -m "feat(standalone-environment): scaffold shared test infrastructure package"
```

---

## Task 2: Extract Docker utilities

**Files:**
- Create: `standalone-environment/src/docker-utils.ts`

- [ ] **Step 1: Create docker-utils.ts**

Extract from `credentials-demo-contract/src/test/integration/standalone-protocol-environment.ts` the Docker-related helpers:

```typescript
import { type StartedDockerComposeEnvironment } from "testcontainers";

/**
 * Check whether a container runtime (Docker/Podman) is available.
 * Returns false if testcontainers cannot connect to a runtime.
 */
export const containerRuntimeAvailable = async (): Promise<boolean> => {
  try {
    const { getContainerRuntimeClient } = await import(
      "testcontainers/build/container-runtime/clients/client.js"
    );
    await getContainerRuntimeClient();
    return true;
  } catch {
    return false;
  }
};

/**
 * Map a container's first exposed port to a localhost URL.
 */
export const mapContainerPort = (
  env: StartedDockerComposeEnvironment,
  url: string,
  containerName: string,
): string => {
  const mappedUrl = new URL(url);
  const container = env.getContainer(containerName);
  mappedUrl.port = String(container.getFirstMappedPort());
  return mappedUrl.toString().replace(/\/+$/, "");
};

/**
 * Race a promise against a timeout. Throws on timeout.
 */
export const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> =>
  await Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);
```

- [ ] **Step 2: Commit**

```bash
git add standalone-environment/src/docker-utils.ts
git commit -S -s -m "feat(standalone-environment): extract Docker utilities"
```

---

## Task 3: Extract standalone config and wallet setup

**Files:**
- Create: `standalone-environment/src/standalone-config.ts`
- Create: `standalone-environment/src/wallet-setup.ts`

- [ ] **Step 1: Create standalone-config.ts**

```typescript
import path from "node:path";

/**
 * Default timeout constants for standalone environment operations.
 */
export const TIMEOUTS = {
  walletSync: 180_000,
  walletFunds: 180_000,
  dustGeneration: 300_000,
  dockerStartup: 180_000,
  didCreationRetryDelay: 8_000,
  didCreationRetries: 3,
} as const;

/**
 * The genesis mint wallet seed used in the dev network.
 */
export const GENESIS_MINT_WALLET_SEED =
  "0000000000000000000000000000000000000000000000000000000000000001";

/**
 * Resolve a unique temporary path for integration test state.
 */
export const integrationPath = (repoRoot: string, category: string, suffix: string): string =>
  path.resolve(repoRoot, ".midnight-test", category, suffix);
```

- [ ] **Step 2: Create wallet-setup.ts**

Extract the wallet initialization logic. This wraps the `@midnight-ntwrk/midnight-did-api` wallet calls with timeout handling.

```typescript
import type { MidnightDIDProviders, MidnightDIDWalletContext } from "../../api/src/index.js";
import {
  buildWallet,
  configureProviders,
  registerForDustGeneration,
  setLogger,
  waitForWalletFunds,
  waitForWalletSync,
} from "../../api/src/index.js";
import { GENESIS_MINT_WALLET_SEED, TIMEOUTS } from "./standalone-config.js";
import { withTimeout } from "./docker-utils.js";

/** Suppress API library logs during integration tests. */
export const silenceLogs = (): void => {
  setLogger({
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  } as never);
};

/**
 * Build and fund a wallet from the genesis seed.
 * Returns both the wallet context and configured providers.
 */
export const setupWallet = async (
  config: Record<string, unknown>,
  logPrefix: string,
): Promise<{ walletCtx: MidnightDIDWalletContext; providers: MidnightDIDProviders }> => {
  console.info(`[${logPrefix}] building wallet`);
  const walletCtx = await buildWallet(config as never, GENESIS_MINT_WALLET_SEED);

  console.info(`[${logPrefix}] waiting for wallet sync`);
  await withTimeout(waitForWalletSync(walletCtx), TIMEOUTS.walletSync, "wallet sync");

  console.info(`[${logPrefix}] waiting for wallet funds`);
  await withTimeout(waitForWalletFunds(walletCtx), TIMEOUTS.walletFunds, "wallet funds");

  console.info(`[${logPrefix}] registering dust generation`);
  await withTimeout(
    registerForDustGeneration(walletCtx.wallet, walletCtx.unshieldedKeystore),
    TIMEOUTS.dustGeneration,
    "dust generation",
  );

  console.info(`[${logPrefix}] configuring providers`);
  const providers = await configureProviders(walletCtx, config as never);

  return { walletCtx, providers };
};
```

- [ ] **Step 3: Commit**

```bash
git add standalone-environment/src/standalone-config.ts standalone-environment/src/wallet-setup.ts
git commit -S -s -m "feat(standalone-environment): extract config and wallet setup"
```

---

## Task 4: Extract DID profile provisioning

**Files:**
- Create: `standalone-environment/src/did-profile.ts`

- [ ] **Step 1: Create did-profile.ts**

Extract the `ProtocolDidProfile` type and `provisionDidProfile` logic from the existing skeleton. This is the core reusable piece.

Read `credentials-demo-contract/src/test/integration/standalone-protocol-environment.ts` lines 56-288 to extract:
- `ProtocolDidProfile` type
- `verifierChallengeForProfile` helper
- `createDidWithDustRetry` with retry logic
- `methodJwkFromSigner` helper
- The full `provisionDidProfile` workflow (deploy contract, resolve, add verification method, add relation, verify)

The function signature should be:

```typescript
export const provisionDidProfile = async (
  providers: MidnightDIDProviders,
  role: "issuer" | "holder" | "verifier",
  signer: { publicKey: JubjubPoint; verificationMethodRef: { didContractAddress: { bytes: Uint8Array }; methodId: Uint8Array } },
  logPrefix: string,
): Promise<ProtocolDidProfile>
```

Use the existing import paths (they reference `../../api/src/index.js`, `../../domain/src/index.js`, etc.) adjusted for the new package location (`../api/src/index.js`, `../domain/src/index.js` from `standalone-environment/src/`).

- [ ] **Step 2: Commit**

```bash
git add standalone-environment/src/did-profile.ts
git commit -S -s -m "feat(standalone-environment): extract DID profile provisioning"
```

---

## Task 5: Create StandaloneEnvironment class and index

**Files:**
- Create: `standalone-environment/src/standalone-environment.ts`
- Create: `standalone-environment/src/index.ts`

- [ ] **Step 1: Create standalone-environment.ts**

This is the main class that orchestrates the Docker lifecycle. Extract from the existing `StandaloneProtocolEnvironment` class, delegating to the modules created in Tasks 2-4.

Read the existing class at `credentials-demo-contract/src/test/integration/standalone-protocol-environment.ts` lines 150-317 and restructure:

```typescript
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DockerComposeEnvironment, type StartedDockerComposeEnvironment, Wait } from "testcontainers";
import * as Rx from "rxjs";
import { StandaloneConfig } from "../../api/src/config.js";
import type { MidnightDIDProviders, MidnightDIDWalletContext } from "../../api/src/index.js";
import { getMidnightNetwork } from "../../api/src/index.js";
import { mapContainerPort } from "./docker-utils.js";
import { silenceLogs, setupWallet } from "./wallet-setup.js";
import { integrationPath, TIMEOUTS } from "./standalone-config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../");

export class StandaloneEnvironment {
  private env: StartedDockerComposeEnvironment | undefined;
  private walletCtx: MidnightDIDWalletContext | undefined;
  private _providers: MidnightDIDProviders | undefined;
  private readonly projectName: string;
  private readonly category: string;
  private readonly fsRoots: string[];

  constructor(category = "standalone") {
    this.category = category;
    this.projectName = `${category}-${Date.now()}`;
    this.fsRoots = [
      integrationPath(REPO_ROOT, category, "wallet"),
      integrationPath(REPO_ROOT, category, "issuer"),
      integrationPath(REPO_ROOT, category, "holder"),
      integrationPath(REPO_ROOT, category, "verifier"),
    ];
  }

  get providers(): MidnightDIDProviders {
    if (!this._providers) throw new Error("StandaloneEnvironment.start() must be called first");
    return this._providers;
  }

  get network(): string {
    return getMidnightNetwork().toString().toLowerCase();
  }

  async start(composePath?: string, composeFile?: string): Promise<MidnightDIDProviders> {
    // Implementation delegates to silenceLogs, Docker startup, mapContainerPort, setupWallet
    // Follow the exact pattern from the existing skeleton
  }

  async waitForWalletSync(): Promise<void> {
    // Delegate to RxJS wallet state check
  }

  async shutdown(): Promise<void> {
    // Stop wallet, docker down with volume removal, cleanup FS
  }
}
```

The `start()` method should accept optional `composePath` and `composeFile` parameters (defaulting to `api/` directory and `standalone.yml`) so different consumers can point to different compose files if needed.

- [ ] **Step 2: Create index.ts**

```typescript
export { StandaloneEnvironment } from "./standalone-environment.js";
export {
  type ProtocolDidProfile,
  provisionDidProfile,
  verifierChallengeForProfile,
} from "./did-profile.js";
export { containerRuntimeAvailable, withTimeout, mapContainerPort } from "./docker-utils.js";
export { TIMEOUTS, GENESIS_MINT_WALLET_SEED, integrationPath } from "./standalone-config.js";
export { silenceLogs, setupWallet } from "./wallet-setup.js";
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit -p standalone-environment/tsconfig.json`

This should pass (or fail only on import resolution issues with the workspace — those are expected since the API package types may need path adjustments).

- [ ] **Step 4: Commit**

```bash
git add standalone-environment/src/
git commit -S -s -m "feat(standalone-environment): add StandaloneEnvironment class and public exports"
```

---

## Task 6: Migrate credentials-demo-contract integration test

**Files:**
- Modify: `credentials-demo-contract/src/test/integration/standalone-protocol-environment.ts`
- Modify: `credentials-demo-contract/src/test/integration/issuance-verification.integration.test.ts`
- Modify: `credentials-demo-contract/package.json` (add dependency on standalone-environment)

- [ ] **Step 1: Update credentials-demo-contract package.json**

Add dependency:
```json
"@midnight-ntwrk/midnight-did-standalone-environment": "*"
```

- [ ] **Step 2: Replace standalone-protocol-environment.ts with a thin re-export**

Replace the contents of `credentials-demo-contract/src/test/integration/standalone-protocol-environment.ts` with:

```typescript
// Re-export from the shared standalone-environment package.
// This file exists for backward compatibility with existing imports.
export {
  StandaloneEnvironment as StandaloneProtocolEnvironment,
  type ProtocolDidProfile,
  verifierChallengeForProfile,
  containerRuntimeAvailable,
} from "../../../../standalone-environment/src/index.js";
```

- [ ] **Step 3: Update the integration test imports**

In `issuance-verification.integration.test.ts`, update the container runtime check to use the shared utility:

Replace the try/catch block (lines 17-25) with:
```typescript
import { containerRuntimeAvailable } from "./standalone-protocol-environment.js";
const canRunContainers = await containerRuntimeAvailable();
const describeIntegration = canRunContainers ? describe : describe.skip;
```

- [ ] **Step 4: Run existing integration test (dry run)**

Run: `npx vitest run credentials-demo-contract/src/test/integration/ --dry-run` or verify it at least compiles.

If Docker is not available locally, the test should skip cleanly.

- [ ] **Step 5: Commit**

```bash
git add credentials-demo-contract/
git commit -S -s -m "refactor(credentials-demo-contract): migrate integration test to shared standalone-environment"
```

---

## Task 7: Add integration vitest config to credentials-protocol

**Files:**
- Create: `credentials-protocol/vitest.integration.config.ts`
- Modify: `credentials-protocol/package.json` (add test:integration script and standalone-environment dependency)

- [ ] **Step 1: Create vitest.integration.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/test/integration/**/*.integration.test.ts"],
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
});
```

- [ ] **Step 2: Update package.json**

Add dependency:
```json
"@midnight-ntwrk/midnight-did-standalone-environment": "*"
```

Add script:
```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```

- [ ] **Step 3: Commit**

```bash
git add credentials-protocol/vitest.integration.config.ts credentials-protocol/package.json
git commit -S -s -m "feat(credentials-protocol): add integration test configuration"
```

---

## Task 8: Explicit-holder integration test

**Files:**
- Create: `credentials-protocol/src/test/integration/explicit-holder-lifecycle.integration.test.ts`

- [ ] **Step 1: Write the integration test**

```typescript
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  containerRuntimeAvailable,
  type ProtocolDidProfile,
  provisionDidProfile,
  StandaloneEnvironment,
} from "../../../../standalone-environment/src/index.js";
import { createSigner } from "../helpers/did-provider.js";
import { MessageBus } from "../../transport/message-bus.js";
import { IssuerAgent } from "../../agents/issuer-agent.js";
import { HolderAgent } from "../../agents/holder-agent.js";
import { VerifierAgent, type SimulatorWitness } from "../../agents/verifier-agent.js";
import type { DIDProfile } from "../../agents/types.js";

const canRun = await containerRuntimeAvailable();
const describeIntegration = canRun ? describe : describe.skip;

const toDIDProfile = (profile: ProtocolDidProfile): DIDProfile => ({
  role: profile.role,
  label: profile.role,
  signer: {
    ...createSigner(profile.role, profile.role === "issuer" ? 123456789n : profile.role === "holder" ? 987654321n : 555555555n),
    verificationMethodRef: profile.verificationMethodRefValue,
  },
});

describeIntegration("explicit-holder lifecycle with real Midnight DIDs", () => {
  const env = new StandaloneEnvironment("credentials-explicit");
  let issuerProfile: ProtocolDidProfile;
  let holderProfile: ProtocolDidProfile;
  let verifierProfile: ProtocolDidProfile;

  beforeAll(async () => {
    setNetworkId("undeployed");
    await env.start();
    const issuerSigner = createSigner("issuer", 123456789n);
    const holderSigner = createSigner("holder", 987654321n);
    const verifierSigner = createSigner("verifier", 555555555n);
    issuerProfile = await provisionDidProfile(env.providers, "issuer", issuerSigner, "explicit-holder");
    holderProfile = await provisionDidProfile(env.providers, "holder", holderSigner, "explicit-holder");
    verifierProfile = await provisionDidProfile(env.providers, "verifier", verifierSigner, "explicit-holder");
  }, 600_000);

  afterAll(async () => {
    await env.shutdown();
  }, 300_000);

  it("issues a credential and verifies a presentation with real DIDs", async () => {
    const bus = new MessageBus();
    const issuer = new IssuerAgent(toDIDProfile(issuerProfile), bus);
    const holder = new HolderAgent(toDIDProfile(holderProfile), bus);
    const verifier = new VerifierAgent(toDIDProfile(verifierProfile), bus);

    // Issuance
    issuer.createAndSendOffer(holderProfile.role);
    holder.receiveOfferAndSendRequest(bus.receive(holderProfile.role)!);
    issuer.receiveRequestAndIssueCredential(bus.receive(issuerProfile.role)!, {
      subjectId: new Uint8Array(32).fill(1),
      subjectOpening: new Uint8Array(32).fill(2),
      legalNamePadded: new Uint8Array(32).fill(3),
      legalNameOpening: new Uint8Array(32).fill(4),
      birthDateDays: 3650n,
      birthDateOpening: new Uint8Array(32).fill(5),
      birthCountryCodePadded: new Uint8Array(32).fill(6),
      birthCountryCodeOpening: new Uint8Array(32).fill(7),
      issuedAt: 10_000n,
      expiresAt: 20_000n,
    });
    holder.receiveCredentialResult(bus.receive(holderProfile.role)!);

    expect(holder.credentialCount).toBe(1);

    // Verify credential is bound to real holder DID
    const stored = holder.getCredential(0);
    expect(stored.credential.holderBinding.holderVerificationMethodRef).toEqual(
      holderProfile.verificationMethodRefValue,
    );
    expect(stored.credential.issuerVerificationMethodRef).toEqual(
      issuerProfile.verificationMethodRefValue,
    );

    // Presentation
    verifier.createAndSendPresentationRequest(holderProfile.role, {
      issuerVerificationMethodRef: issuerProfile.verificationMethodRefValue,
      requireSubjectIdCommitmentDisclosure: false,
      requireBirthCountryDisclosure: true,
      requireAgeOverThreshold: true,
      requestedAgeThresholdYears: 18,
    });

    const request = bus.receive(holderProfile.role)!;
    holder.receiveRequestAndSendPresentation(request, {
      credentialIndex: 0,
      currentDay: 12775n,
      birthDateDays: 3650n,
      birthDateOpening: new Uint8Array(32).fill(5),
      birthCountryCodePadded: new Uint8Array(32).fill(6),
      birthCountryCodeOpening: new Uint8Array(32).fill(7),
    });

    const submission = bus.receive(verifierProfile.role)!;
    const simulatorWitness: SimulatorWitness = {
      request: request.body as any,
      currentDay: 12775n,
      birthDateDays: 3650n,
      birthDateOpening: new Uint8Array(32).fill(5),
    };

    const result = verifier.receiveSubmissionAndEvaluate(submission, simulatorWitness);
    expect(result.approved).toBe(true);
  }, 600_000);
});
```

- [ ] **Step 2: Verify test compiles (dry run)**

Run: `npx tsc --noEmit -p credentials-protocol/tsconfig.json` to check types.

- [ ] **Step 3: Commit**

```bash
git add credentials-protocol/src/test/integration/explicit-holder-lifecycle.integration.test.ts
git commit -S -s -m "feat(credentials-protocol): add explicit-holder integration test with real DIDs"
```

---

## Task 9: Secret-holder integration test

**Files:**
- Create: `credentials-protocol/src/test/integration/secret-holder-lifecycle.integration.test.ts`

- [ ] **Step 1: Write the integration test**

Same pattern as Task 8, but:
- Provision only an issuer DID (holder has no DID — uses hidden secret)
- Use `SecretIssuerAgent` and `SecretHolderAgent`
- Test secret-holder issuance and presentation with verifier-scoped pseudonym
- Use `SecretSimulatorWitness` for the verifier

Provision: issuer DID only. Holder uses `{ label: "alice", holderSecret: fill(11), holderSecretOpening: fill(13) }`.

Test scenarios:
1. "issues a secret credential and verifies with pseudonym using real issuer DID"

- [ ] **Step 2: Commit**

```bash
git add credentials-protocol/src/test/integration/secret-holder-lifecycle.integration.test.ts
git commit -S -s -m "feat(credentials-protocol): add secret-holder integration test with real DIDs"
```

---

## Task 10: Contract-verifier integration test

**Files:**
- Create: `credentials-protocol/src/test/integration/contract-verifier-lifecycle.integration.test.ts`

- [ ] **Step 1: Write the integration test**

Same setup pattern. This test exercises the `ContractVerifier` (which wraps the demo contract simulator) with credentials bound to real Midnight DIDs.

Provision: issuer DID, holder DID.

Test scenarios:
1. "completes age-gate verification and capability lifecycle with real DIDs"
   - Issue credential via protocol with real DID profiles
   - Register with ContractVerifier
   - Execute age-gate → issue capability → claim → reject re-claim

- [ ] **Step 2: Commit**

```bash
git add credentials-protocol/src/test/integration/contract-verifier-lifecycle.integration.test.ts
git commit -S -s -m "feat(credentials-protocol): add contract-verifier integration test with real DIDs"
```

---

## Task 11: Verify and push

- [ ] **Step 1: Run simulator tests (regression check)**

Run: `npm run test --workspace=credentials-protocol`
Expected: 21 simulator tests PASS (existing tests unbroken)

- [ ] **Step 2: Run integration tests (if Docker available)**

Run: `npm run test:integration --workspace=credentials-protocol`
Expected: 3 integration tests PASS (or skip if no Docker)

- [ ] **Step 3: Run full suite across all packages**

Run all workspace tests to confirm no regressions.

- [ ] **Step 4: Final commit and push**

```bash
git push
```
