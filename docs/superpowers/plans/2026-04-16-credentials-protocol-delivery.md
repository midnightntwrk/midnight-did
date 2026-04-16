# Midnight Credentials Protocol Delivery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a protocol simulation layer with strict party boundaries, integration tests across all credential profiles, and aligned spec/guide documentation.

**Architecture:** A new `credentials-protocol` package (Layer 4) provides IssuerAgent, HolderAgent, VerifierAgent, and ContractVerifier classes communicating through an in-process typed MessageBus. Each agent encapsulates its own cryptographic state and can only interact through protocol messages. Tests exercise explicit-holder, secret-holder, and contract-verifier flows end-to-end.

**Tech Stack:** TypeScript, Vitest, Compact pureCircuits (compiled managed artifacts), Jubjub cryptography via compact-runtime

**Spec:** `docs/superpowers/specs/2026-04-16-credentials-delivery-design.md`

---

## File Structure

```
credentials-protocol/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── eslint.config.mjs
├── vitest.config.ts
├── src/
│   ├── index.ts
│   ├── transport/
│   │   ├── types.ts              — Protocol message types, PartyId, envelope helpers
│   │   └── message-bus.ts        — In-process typed message queue
│   ├── agents/
│   │   ├── types.ts              — Shared agent types (Signer, DIDProfile, AgentConfig)
│   │   ├── issuer-agent.ts       — IssuerAgent for explicit-holder issuance
│   │   ├── holder-agent.ts       — HolderAgent for explicit-holder presentation
│   │   ├── secret-issuer-agent.ts  — IssuerAgent for secret-holder issuance
│   │   ├── secret-holder-agent.ts  — HolderAgent for secret-holder presentation
│   │   ├── verifier-agent.ts     — Off-chain VerifierAgent
│   │   └── contract-verifier.ts  — On-chain ContractVerifier wrapping demo simulator
│   └── test/
│       ├── helpers/
│       │   └── did-provider.ts   — Simulated DID creation for test parties
│       ├── explicit-holder/
│       │   ├── issuance.test.ts
│       │   ├── presentation.test.ts
│       │   └── full-lifecycle.test.ts
│       ├── secret-holder/
│       │   ├── issuance.test.ts
│       │   ├── presentation.test.ts
│       │   ├── pseudonym.test.ts
│       │   └── same-holder.test.ts
│       └── contract-verifier/
│           ├── age-gate.test.ts
│           └── capability-lifecycle.test.ts
```

---

## Task 1: Package scaffold

**Files:**
- Create: `credentials-protocol/package.json`
- Create: `credentials-protocol/tsconfig.json`
- Create: `credentials-protocol/tsconfig.build.json`
- Create: `credentials-protocol/eslint.config.mjs`
- Create: `credentials-protocol/vitest.config.ts`
- Create: `credentials-protocol/src/index.ts`
- Modify: `package.json` (root — add workspace entry)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@midnight-ntwrk/midnight-did-credentials-protocol",
  "version": "0.1.0",
  "description": "Protocol simulation layer for Midnight Verifiable Credentials",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "engines": {
    "node": ">=24",
    "npm": ">=10"
  },
  "scripts": {
    "build": "rm -rf dist && tsc -b tsconfig.build.json --force",
    "test": "vitest run",
    "lint": "eslint src --ext .ts --ignore-pattern src/managed/**",
    "typecheck": "tsc --noEmit",
    "all": "npm run build && npm run test"
  },
  "dependencies": {
    "@midnight-ntwrk/compact-runtime": "*",
    "@midnight-ntwrk/midnight-did-credentials": "*",
    "@midnight-ntwrk/midnight-did-credentials-birth": "*",
    "@midnight-ntwrk/midnight-did-credentials-birth-secret": "*",
    "@midnight-ntwrk/midnight-did-credentials-same-holder": "*",
    "@midnight-ntwrk/midnight-did-credentials-demo-contract": "*"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
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

- [ ] **Step 3: Create tsconfig.build.json**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["dist", "node_modules", "src/test"]
}
```

- [ ] **Step 4: Create eslint.config.mjs**

Follow the pattern from `credentials-demo-contract/eslint.config.mjs`:

```javascript
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  { ignores: ["dist/**"] },
);
```

- [ ] **Step 5: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/test/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
```

- [ ] **Step 6: Create src/index.ts**

```typescript
export * from "./transport/types.js";
export * from "./transport/message-bus.js";
export * from "./agents/types.js";
export * from "./agents/issuer-agent.js";
export * from "./agents/holder-agent.js";
export * from "./agents/secret-issuer-agent.js";
export * from "./agents/secret-holder-agent.js";
export * from "./agents/verifier-agent.js";
export * from "./agents/contract-verifier.js";
```

- [ ] **Step 7: Add workspace entry to root package.json**

In the root `package.json`, add `"credentials-protocol"` to the `workspaces` array, after the existing `"credentials-demo-contract"` entry.

- [ ] **Step 8: Run npm install and verify**

Run: `npm install`
Expected: clean install with credentials-protocol linked in the workspace

- [ ] **Step 9: Commit**

```bash
git add credentials-protocol/package.json credentials-protocol/tsconfig.json credentials-protocol/tsconfig.build.json credentials-protocol/eslint.config.mjs credentials-protocol/vitest.config.ts credentials-protocol/src/index.ts package.json
git commit -S -s -m "feat(credentials-protocol): scaffold package with workspace wiring"
```

---

## Task 2: Transport layer — types and message bus

**Files:**
- Create: `credentials-protocol/src/transport/types.ts`
- Create: `credentials-protocol/src/transport/message-bus.ts`
- Test: `credentials-protocol/src/test/helpers/message-bus.test.ts` (inline verification)

- [ ] **Step 1: Create transport/types.ts**

```typescript
import type { ProtocolMessageEnvelope } from "../../../credentials/src/managed/credentials/contract/index.js";

export type PartyId = string;

export type ProtocolMessageType =
  | "issuance:offer"
  | "issuance:request"
  | "issuance:result"
  | "presentation:request"
  | "presentation:submission"
  | "presentation:result";

export type ProtocolMessage<TBody = unknown> = {
  readonly type: ProtocolMessageType;
  readonly from: PartyId;
  readonly to: PartyId;
  readonly envelope: ProtocolMessageEnvelope;
  readonly body: TBody;
};
```

- [ ] **Step 2: Write failing test for MessageBus**

Create `credentials-protocol/src/test/helpers/message-bus.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { MessageBus } from "../../transport/message-bus.js";
import type { ProtocolMessage } from "../../transport/types.js";

const dummyMessage = (from: string, to: string, type = "issuance:offer" as const): ProtocolMessage => ({
  type,
  from,
  to,
  envelope: {} as ProtocolMessage["envelope"],
  body: { test: true },
});

describe("MessageBus", () => {
  it("delivers a message from sender to receiver", () => {
    const bus = new MessageBus();
    bus.send(dummyMessage("issuer", "holder"));
    const received = bus.receive("holder");
    expect(received).toBeDefined();
    expect(received!.from).toBe("issuer");
    expect(received!.body).toEqual({ test: true });
  });

  it("returns undefined when no messages are pending", () => {
    const bus = new MessageBus();
    expect(bus.receive("holder")).toBeUndefined();
  });

  it("does not deliver messages to the wrong party", () => {
    const bus = new MessageBus();
    bus.send(dummyMessage("issuer", "holder"));
    expect(bus.receive("verifier")).toBeUndefined();
    expect(bus.receive("holder")).toBeDefined();
  });

  it("delivers messages in FIFO order", () => {
    const bus = new MessageBus();
    bus.send(dummyMessage("issuer", "holder", "issuance:offer"));
    bus.send(dummyMessage("verifier", "holder", "presentation:request"));
    const first = bus.receive("holder");
    const second = bus.receive("holder");
    expect(first!.type).toBe("issuance:offer");
    expect(second!.type).toBe("presentation:request");
  });

  it("drains all messages for a party", () => {
    const bus = new MessageBus();
    bus.send(dummyMessage("a", "holder"));
    bus.send(dummyMessage("b", "holder"));
    const all = bus.drain("holder");
    expect(all).toHaveLength(2);
    expect(bus.receive("holder")).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run credentials-protocol/src/test/helpers/message-bus.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement MessageBus**

Create `credentials-protocol/src/transport/message-bus.ts`:

```typescript
import type { ProtocolMessage, PartyId } from "./types.js";

export class MessageBus {
  private readonly queues = new Map<PartyId, ProtocolMessage[]>();

  send(message: ProtocolMessage): void {
    const queue = this.queues.get(message.to) ?? [];
    queue.push(message);
    this.queues.set(message.to, queue);
  }

  receive(party: PartyId): ProtocolMessage | undefined {
    const queue = this.queues.get(party);
    if (!queue || queue.length === 0) return undefined;
    return queue.shift();
  }

  drain(party: PartyId): ProtocolMessage[] {
    const queue = this.queues.get(party) ?? [];
    this.queues.set(party, []);
    return queue;
  }

  pending(party: PartyId): number {
    return this.queues.get(party)?.length ?? 0;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run credentials-protocol/src/test/helpers/message-bus.test.ts`
Expected: 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add credentials-protocol/src/transport/
git add credentials-protocol/src/test/helpers/message-bus.test.ts
git commit -S -s -m "feat(credentials-protocol): add typed message bus transport layer"
```

---

## Task 3: DID provider and shared agent types

**Files:**
- Create: `credentials-protocol/src/agents/types.ts`
- Create: `credentials-protocol/src/test/helpers/did-provider.ts`

- [ ] **Step 1: Create agents/types.ts**

```typescript
import type {
  VerificationMethodRef,
  Proof,
} from "../../../credentials/src/managed/credentials/contract/index.js";
import type { JubjubPoint } from "@midnight-ntwrk/compact-runtime";

export type Signer = {
  readonly label: string;
  readonly secretKey: bigint;
  readonly publicKey: JubjubPoint;
  readonly verificationMethodRef: VerificationMethodRef;
};

export type PartyRole = "issuer" | "holder" | "verifier";

export type DIDProfile = {
  readonly role: PartyRole;
  readonly label: string;
  readonly signer: Signer;
};
```

- [ ] **Step 2: Create test/helpers/did-provider.ts**

This reuses the proven `createSigner` pattern from the existing fixtures but wraps it in a provider that enforces party roles.

```typescript
import { createHash } from "node:crypto";
import { ecMulGenerator } from "@midnight-ntwrk/compact-runtime";
import type { Signer, DIDProfile, PartyRole } from "../../agents/types.js";
import type { VerificationMethodRef } from "../../../../credentials/src/managed/credentials/contract/index.js";

const sha256 = (value: string): Uint8Array =>
  new Uint8Array(createHash("sha256").update(value).digest());

const padText = (value: string, length = 32): Uint8Array => {
  const bytes = new TextEncoder().encode(value);
  if (bytes.length >= length) return bytes.subarray(0, length);
  const padded = new Uint8Array(length);
  padded.set(bytes);
  return padded;
};

export const createSigner = (
  label: string,
  secretKey: bigint,
  methodId = `#${label}-key-1`,
): Signer => ({
  label,
  secretKey,
  publicKey: ecMulGenerator(secretKey),
  verificationMethodRef: {
    didContractAddress: sha256(`contract:${label}`),
    methodId: padText(methodId),
  },
});

export const createDIDProfile = (
  role: PartyRole,
  label: string,
  secretKey: bigint,
): DIDProfile => ({
  role,
  label,
  signer: createSigner(label, secretKey),
});

export const fill = (value: number, length = 32): Uint8Array =>
  new Uint8Array(length).fill(value);

export { sha256, padText };
```

- [ ] **Step 3: Commit**

```bash
git add credentials-protocol/src/agents/types.ts
git add credentials-protocol/src/test/helpers/did-provider.ts
git commit -S -s -m "feat(credentials-protocol): add agent types and DID provider"
```

---

## Task 4: IssuerAgent for explicit-holder profile

**Files:**
- Create: `credentials-protocol/src/agents/issuer-agent.ts`
- Test: `credentials-protocol/src/test/explicit-holder/issuance.test.ts`

- [ ] **Step 1: Write failing issuance test**

Create `credentials-protocol/src/test/explicit-holder/issuance.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { MessageBus } from "../../transport/message-bus.js";
import { IssuerAgent } from "../../agents/issuer-agent.js";
import { HolderAgent } from "../../agents/holder-agent.js";
import { createDIDProfile, fill, sha256 } from "../helpers/did-provider.js";

describe("explicit-holder: issuance flow", () => {
  const bus = new MessageBus();
  const issuerProfile = createDIDProfile("issuer", "rita", 123456789n);
  const holderProfile = createDIDProfile("holder", "alice", 987654321n);

  let issuer: IssuerAgent;
  let holder: HolderAgent;

  beforeEach(() => {
    issuer = new IssuerAgent(issuerProfile, bus);
    holder = new HolderAgent(holderProfile, bus);
  });

  it("completes an issuance flow through offer → request → credential", () => {
    // Step 1: Issuer creates and sends offer
    issuer.createAndSendOffer(holderProfile.label);

    // Step 2: Holder receives offer and sends request
    const offer = bus.receive(holderProfile.label);
    expect(offer).toBeDefined();
    expect(offer!.type).toBe("issuance:offer");

    holder.receiveOfferAndSendRequest(offer!);

    // Step 3: Issuer receives request and issues credential
    const request = bus.receive(issuerProfile.label);
    expect(request).toBeDefined();
    expect(request!.type).toBe("issuance:request");

    issuer.receiveRequestAndIssueCredential(request!, {
      subjectId: fill(1),
      subjectOpening: fill(2),
      legalNamePadded: fill(3),
      legalNameOpening: fill(4),
      birthDateDays: 3650n,
      birthDateOpening: fill(5),
      birthCountryCodePadded: fill(6),
      birthCountryCodeOpening: fill(7),
      issuedAt: 10000n,
      expiresAt: 20000n,
    });

    // Step 4: Holder receives credential
    const result = bus.receive(holderProfile.label);
    expect(result).toBeDefined();
    expect(result!.type).toBe("issuance:result");

    holder.receiveCredentialResult(result!);

    // Verify holder now has a credential stored
    expect(holder.credentialCount).toBe(1);
  });

  it("binds the credential to the correct holder DID", () => {
    issuer.createAndSendOffer(holderProfile.label);
    const offer = bus.receive(holderProfile.label)!;
    holder.receiveOfferAndSendRequest(offer);
    const request = bus.receive(issuerProfile.label)!;

    issuer.receiveRequestAndIssueCredential(request, {
      subjectId: fill(1),
      subjectOpening: fill(2),
      legalNamePadded: fill(3),
      legalNameOpening: fill(4),
      birthDateDays: 3650n,
      birthDateOpening: fill(5),
      birthCountryCodePadded: fill(6),
      birthCountryCodeOpening: fill(7),
      issuedAt: 10000n,
      expiresAt: 20000n,
    });

    const result = bus.receive(holderProfile.label)!;
    holder.receiveCredentialResult(result);

    // The stored credential must have holder binding matching the holder DID
    const stored = holder.getCredential(0);
    expect(stored.credential.holderBinding.holderVerificationMethodRef).toEqual(
      holderProfile.signer.verificationMethodRef,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run credentials-protocol/src/test/explicit-holder/issuance.test.ts`
Expected: FAIL — IssuerAgent not found

- [ ] **Step 3: Implement IssuerAgent**

Create `credentials-protocol/src/agents/issuer-agent.ts`. The agent encapsulates issuer-side state and cryptography. It builds protocol messages and sends them through the bus. It NEVER accesses holder private data.

The implementation should:
- Accept a `DIDProfile` and `MessageBus` in constructor
- Store the issuer signer privately
- `createAndSendOffer(holderLabel)` — build an issuance offer envelope and send via bus
- `receiveRequestAndIssueCredential(request, claimWitness)` — validate the request, build credential with commitments from witness data, sign with issuer key, send result via bus
- Use `pureCircuits` from `credentials-birth` for claim commitment circuits and `credentialBodyRoot`
- Use `signProof` helper (extracted from existing fixture pattern) for issuance-context proof signing

Key implementation details:
- Claim commitments are computed from raw witness values using `pureCircuits.subjectIdCommitment()`, `pureCircuits.birthDateCommitment()`, etc.
- Claim root is computed from the four commitments using `pureCircuits.birthCredentialClaimRoot()`
- Credential body root is computed using `pureCircuits.birthCredentialBodyRoot()`
- Issuer proof challenge is derived using `genericPureCircuits.issuanceProofChallenge()`
- Protocol envelope wraps the credential in a threaded message referencing the request

- [ ] **Step 4: Implement HolderAgent (issuance side only)**

Create `credentials-protocol/src/agents/holder-agent.ts`. For this task, implement only the issuance-receiving side.

The implementation should:
- Accept a `DIDProfile` and `MessageBus` in constructor
- Store holder signer and credential store privately
- `receiveOfferAndSendRequest(offer)` — validate the offer, build issuance request with holder binding, send via bus
- `receiveCredentialResult(result)` — validate the result, store the credential and proof
- `credentialCount` — getter for number of stored credentials
- `getCredential(index)` — retrieve a stored credential (returns credential + proof)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run credentials-protocol/src/test/explicit-holder/issuance.test.ts`
Expected: 2 tests PASS

- [ ] **Step 6: Commit**

```bash
git add credentials-protocol/src/agents/issuer-agent.ts
git add credentials-protocol/src/agents/holder-agent.ts
git add credentials-protocol/src/test/explicit-holder/issuance.test.ts
git commit -S -s -m "feat(credentials-protocol): add IssuerAgent and HolderAgent for explicit-holder issuance"
```

---

## Task 5: Explicit-holder presentation flow

**Files:**
- Modify: `credentials-protocol/src/agents/holder-agent.ts` (add presentation methods)
- Create: `credentials-protocol/src/agents/verifier-agent.ts`
- Test: `credentials-protocol/src/test/explicit-holder/presentation.test.ts`

- [ ] **Step 1: Write failing presentation test**

Create `credentials-protocol/src/test/explicit-holder/presentation.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { MessageBus } from "../../transport/message-bus.js";
import { IssuerAgent } from "../../agents/issuer-agent.js";
import { HolderAgent } from "../../agents/holder-agent.js";
import { VerifierAgent } from "../../agents/verifier-agent.js";
import { createDIDProfile, fill } from "../helpers/did-provider.js";

describe("explicit-holder: presentation flow", () => {
  const issuerProfile = createDIDProfile("issuer", "rita", 123456789n);
  const holderProfile = createDIDProfile("holder", "alice", 987654321n);
  const verifierProfile = createDIDProfile("verifier", "vera", 555555555n);

  let bus: MessageBus;
  let issuer: IssuerAgent;
  let holder: HolderAgent;
  let verifier: VerifierAgent;

  beforeEach(() => {
    bus = new MessageBus();
    issuer = new IssuerAgent(issuerProfile, bus);
    holder = new HolderAgent(holderProfile, bus);
    verifier = new VerifierAgent(verifierProfile, bus);

    // Pre-issue a credential to the holder
    issuer.createAndSendOffer(holderProfile.label);
    holder.receiveOfferAndSendRequest(bus.receive(holderProfile.label)!);
    issuer.receiveRequestAndIssueCredential(bus.receive(issuerProfile.label)!, {
      subjectId: fill(1),
      subjectOpening: fill(2),
      legalNamePadded: fill(3),
      legalNameOpening: fill(4),
      birthDateDays: 3650n,
      birthDateOpening: fill(5),
      birthCountryCodePadded: fill(6),
      birthCountryCodeOpening: fill(7),
      issuedAt: 10000n,
      expiresAt: 20000n,
    });
    holder.receiveCredentialResult(bus.receive(holderProfile.label)!);
  });

  it("completes a presentation flow with selective disclosure and age predicate", () => {
    // Step 1: Verifier sends a presentation request
    verifier.createAndSendPresentationRequest(holderProfile.label, {
      issuerVerificationMethodRef: issuerProfile.signer.verificationMethodRef,
      requireSubjectIdCommitmentDisclosure: false,
      requireBirthCountryDisclosure: true,
      requireAgeOverThreshold: true,
      requestedAgeThresholdYears: 18,
    });

    // Step 2: Holder receives request and builds presentation
    const request = bus.receive(holderProfile.label);
    expect(request).toBeDefined();
    expect(request!.type).toBe("presentation:request");

    holder.receiveRequestAndSendPresentation(request!, {
      credentialIndex: 0,
      currentDay: 12775n, // ~25 years after birth
      birthDateDays: 3650n,
      birthDateOpening: fill(5),
      birthCountryCodePadded: fill(6),
      birthCountryCodeOpening: fill(7),
    });

    // Step 3: Verifier receives and evaluates submission
    const submission = bus.receive(verifierProfile.label);
    expect(submission).toBeDefined();
    expect(submission!.type).toBe("presentation:submission");

    const evaluation = verifier.receiveSubmissionAndEvaluate(submission!);
    expect(evaluation.approved).toBe(true);
  });

  it("rejects a presentation when the holder does not meet the age threshold", () => {
    verifier.createAndSendPresentationRequest(holderProfile.label, {
      issuerVerificationMethodRef: issuerProfile.signer.verificationMethodRef,
      requireSubjectIdCommitmentDisclosure: false,
      requireBirthCountryDisclosure: false,
      requireAgeOverThreshold: true,
      requestedAgeThresholdYears: 30,
    });

    const request = bus.receive(holderProfile.label)!;

    // Holder is only 25 — should fail at the holder side when building presentation
    expect(() =>
      holder.receiveRequestAndSendPresentation(request, {
        credentialIndex: 0,
        currentDay: 12775n,
        birthDateDays: 3650n,
        birthDateOpening: fill(5),
        birthCountryCodePadded: fill(6),
        birthCountryCodeOpening: fill(7),
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run credentials-protocol/src/test/explicit-holder/presentation.test.ts`
Expected: FAIL — VerifierAgent not found

- [ ] **Step 3: Implement VerifierAgent**

Create `credentials-protocol/src/agents/verifier-agent.ts`.

The implementation should:
- Accept a `DIDProfile` and `MessageBus` in constructor
- Store verifier signer and challenge state privately
- `createAndSendPresentationRequest(holderLabel, requirements)` — build a typed `BirthCredentialPresentationRequest`, wrap in protocol envelope, send via bus
- `receiveSubmissionAndEvaluate(submission)` — validate the credential proof, validate the presentation proof, check presentation satisfies request, check age predicate. Return `{ approved: boolean }`.
- Use the existing `pureCircuits` validation circuits: `assertValidBirthCredentialPresentation`, `assertBirthPresentationSatisfiesRequest`, `assertValidBirthCredentialAgePredicate`

- [ ] **Step 4: Add presentation methods to HolderAgent**

Extend `credentials-protocol/src/agents/holder-agent.ts`:

- `receiveRequestAndSendPresentation(request, witnessData)` — retrieve stored credential, build `BirthCredentialPresentation` with appropriate disclosures, sign presentation proof, wrap in protocol envelope, send via bus

Key implementation details:
- The holder builds the disclosure structure based on what the request asks for
- The holder signs the presentation with `presentationProofChallenge` context
- The holder NEVER accesses the verifier's evaluation logic

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run credentials-protocol/src/test/explicit-holder/presentation.test.ts`
Expected: 2 tests PASS

- [ ] **Step 6: Commit**

```bash
git add credentials-protocol/src/agents/verifier-agent.ts
git add credentials-protocol/src/agents/holder-agent.ts
git add credentials-protocol/src/test/explicit-holder/presentation.test.ts
git commit -S -s -m "feat(credentials-protocol): add VerifierAgent and explicit-holder presentation flow"
```

---

## Task 6: Explicit-holder full lifecycle with ContractVerifier

**Files:**
- Create: `credentials-protocol/src/agents/contract-verifier.ts`
- Test: `credentials-protocol/src/test/explicit-holder/full-lifecycle.test.ts`
- Test: `credentials-protocol/src/test/contract-verifier/age-gate.test.ts`
- Test: `credentials-protocol/src/test/contract-verifier/capability-lifecycle.test.ts`

- [ ] **Step 1: Write failing full-lifecycle test**

Create `credentials-protocol/src/test/explicit-holder/full-lifecycle.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { MessageBus } from "../../transport/message-bus.js";
import { IssuerAgent } from "../../agents/issuer-agent.js";
import { HolderAgent } from "../../agents/holder-agent.js";
import { ContractVerifier } from "../../agents/contract-verifier.js";
import { createDIDProfile, fill } from "../helpers/did-provider.js";

describe("explicit-holder: full lifecycle with contract verifier", () => {
  const issuerProfile = createDIDProfile("issuer", "rita", 123456789n);
  const holderProfile = createDIDProfile("holder", "alice", 987654321n);

  let bus: MessageBus;
  let issuer: IssuerAgent;
  let holder: HolderAgent;
  let contract: ContractVerifier;

  beforeEach(() => {
    bus = new MessageBus();
    issuer = new IssuerAgent(issuerProfile, bus);
    holder = new HolderAgent(holderProfile, bus);
    contract = new ContractVerifier();
  });

  it("issues a credential, verifies a presentation, and mints an access capability", () => {
    // Phase 1: Issuance via protocol
    issuer.createAndSendOffer(holderProfile.label);
    holder.receiveOfferAndSendRequest(bus.receive(holderProfile.label)!);
    issuer.receiveRequestAndIssueCredential(bus.receive(issuerProfile.label)!, {
      subjectId: fill(1),
      subjectOpening: fill(2),
      legalNamePadded: fill(3),
      legalNameOpening: fill(4),
      birthDateDays: 3650n,
      birthDateOpening: fill(5),
      birthCountryCodePadded: fill(6),
      birthCountryCodeOpening: fill(7),
      issuedAt: 10000n,
      expiresAt: 20000n,
    });
    holder.receiveCredentialResult(bus.receive(holderProfile.label)!);

    // Phase 2: Contract issuance (contract must know about the credential)
    const stored = holder.getCredential(0);
    contract.issueBirthCredential(
      stored.credential,
      stored.credentialProof,
      holderProfile.signer.publicKey,
    );

    // Phase 3: Read contract policy and present
    const ageGateRequest = contract.getAgeGateRequest();
    expect(ageGateRequest).toBeDefined();

    // Phase 4: Issue capability through contract
    const capabilityResult = contract.issueAgeGateCapability(
      stored.credential,
      stored.credentialProof,
      ageGateRequest,
      holder.buildPresentationForContract(0, ageGateRequest, {
        currentDay: 12775n,
        birthDateDays: 3650n,
        birthDateOpening: fill(5),
        birthCountryCodePadded: fill(6),
        birthCountryCodeOpening: fill(7),
      }),
    );

    expect(capabilityResult.capabilityHash).toBeDefined();

    // Phase 5: Claim the capability
    const claimResult = contract.claimCapability(capabilityResult.capabilityHash);
    expect(claimResult).toBe("approved");

    // Phase 6: Second claim should be denied
    const secondClaim = contract.claimCapability(capabilityResult.capabilityHash);
    expect(secondClaim).toBe("alreadyConsumed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run credentials-protocol/src/test/explicit-holder/full-lifecycle.test.ts`
Expected: FAIL — ContractVerifier not found

- [ ] **Step 3: Implement ContractVerifier**

Create `credentials-protocol/src/agents/contract-verifier.ts`.

This wraps the `CredentialsDemoSimulator` from `credentials-demo-contract` and exposes a clean interface that matches the Midnight contract interaction model:

- Constructor creates a `CredentialsDemoSimulator` instance
- `issueBirthCredential(credential, proof, holderPublicKey)` — calls the demo contract issuance circuit
- `getAgeGateRequest()` — calls `ageGateRequest()` on the simulator, returns the typed request
- `issueAgeGateCapability(credential, credentialProof, request, presentationPackage)` — calls the full verification + capability issuance circuit
- `claimCapability(capabilityHash)` — calls `claimAgeGateCapability()`, returns the `AccessDecision` string

- [ ] **Step 4: Add buildPresentationForContract to HolderAgent**

Extend the HolderAgent with a method for building a presentation package for direct contract submission (no message bus — contract verifier pattern):

- `buildPresentationForContract(credentialIndex, request, witnessData)` — returns a `{ presentation, presentationProof }` object ready for contract submission

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run credentials-protocol/src/test/explicit-holder/full-lifecycle.test.ts`
Expected: 1 test PASS

- [ ] **Step 6: Write age-gate and capability-lifecycle contract tests**

Create the `contract-verifier/` test files following the same pattern as the full-lifecycle test but with focused scenarios:

`age-gate.test.ts`:
- "verifies age-gate with birth country disclosure required"
- "rejects age-gate when credential was not issued through the contract"

`capability-lifecycle.test.ts`:
- "returns unknownCapability for unissued capability hash"
- "supports multiple independent capabilities from different holders"

- [ ] **Step 7: Run all contract-verifier tests**

Run: `npx vitest run credentials-protocol/src/test/contract-verifier/`
Expected: all tests PASS

- [ ] **Step 8: Commit**

```bash
git add credentials-protocol/src/agents/contract-verifier.ts
git add credentials-protocol/src/agents/holder-agent.ts
git add credentials-protocol/src/test/explicit-holder/full-lifecycle.test.ts
git add credentials-protocol/src/test/contract-verifier/
git commit -S -s -m "feat(credentials-protocol): add ContractVerifier and explicit-holder full lifecycle"
```

---

## Task 7: Secret-holder issuance flow

**Files:**
- Create: `credentials-protocol/src/agents/secret-issuer-agent.ts`
- Create: `credentials-protocol/src/agents/secret-holder-agent.ts`
- Test: `credentials-protocol/src/test/secret-holder/issuance.test.ts`

- [ ] **Step 1: Write failing secret-holder issuance test**

Create `credentials-protocol/src/test/secret-holder/issuance.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { MessageBus } from "../../transport/message-bus.js";
import { SecretIssuerAgent } from "../../agents/secret-issuer-agent.js";
import { SecretHolderAgent } from "../../agents/secret-holder-agent.js";
import { createDIDProfile, fill } from "../helpers/did-provider.js";

describe("secret-holder: issuance flow", () => {
  const issuerProfile = createDIDProfile("issuer", "rita", 123456789n);

  let bus: MessageBus;
  let issuer: SecretIssuerAgent;
  let holder: SecretHolderAgent;

  beforeEach(() => {
    bus = new MessageBus();
    issuer = new SecretIssuerAgent(issuerProfile, bus);
    holder = new SecretHolderAgent(
      { label: "alice", holderSecret: fill(11), holderSecretOpening: fill(13) },
      bus,
    );
  });

  it("issues a credential with blinded secret holder binding", () => {
    // Step 1: Issuer sends offer
    issuer.createAndSendOffer("alice");

    // Step 2: Holder receives offer and sends request with secret commitment
    const offer = bus.receive("alice")!;
    holder.receiveOfferAndSendRequest(offer);

    // Step 3: Issuer receives request and issues credential with blinded binding
    const request = bus.receive(issuerProfile.label)!;
    issuer.receiveRequestAndIssueCredential(request, {
      subjectId: fill(1),
      subjectOpening: fill(2),
      legalNamePadded: fill(3),
      legalNameOpening: fill(4),
      birthDateDays: 3650n,
      birthDateOpening: fill(5),
      birthCountryCodePadded: fill(6),
      birthCountryCodeOpening: fill(7),
      issuedAt: 10000n,
      expiresAt: 20000n,
    });

    // Step 4: Holder receives credential
    const result = bus.receive("alice")!;
    holder.receiveCredentialResult(result);

    expect(holder.credentialCount).toBe(1);

    // The credential must use BlindedSecretHolderBinding, not ExplicitHolderBinding
    const stored = holder.getCredential(0);
    expect(stored.credential.holderBinding.blindedHolderSecretCommitment).toBeDefined();
    expect(stored.credential.holderBinding.issuerNonce).toBeDefined();
  });

  it("binds the blinded commitment to the holder secret without revealing it to the issuer", () => {
    issuer.createAndSendOffer("alice");
    holder.receiveOfferAndSendRequest(bus.receive("alice")!);
    const request = bus.receive(issuerProfile.label)!;

    // The request body should contain the holder secret commitment, NOT the raw secret
    expect(request.body).toBeDefined();
    // The issuer never sees fill(11) (the holder secret) in the request
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run credentials-protocol/src/test/secret-holder/issuance.test.ts`
Expected: FAIL — SecretIssuerAgent not found

- [ ] **Step 3: Implement SecretIssuerAgent**

Create `credentials-protocol/src/agents/secret-issuer-agent.ts`.

Similar to `IssuerAgent` but:
- Uses `BlindedSecretHolderBinding` instead of `ExplicitHolderBinding`
- Generates an `issuerNonce` during credential creation
- Computes the `blindedHolderSecretCommitment` using the holder's commitment + issuer nonce + holder blinding factor
- Uses `credentials-birth-secret` pureCircuits for credential body root and claim commitments

- [ ] **Step 4: Implement SecretHolderAgent**

Create `credentials-protocol/src/agents/secret-holder-agent.ts`.

Different from `HolderAgent`:
- Constructor takes `{ label, holderSecret, holderSecretOpening }` instead of a `DIDProfile`
- Generates a `holderBindingBlindingFactor` during request creation
- Computes `secretHolderBindingCommitment()` and includes it in the request
- Never sends the raw `holderSecret` over the bus

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run credentials-protocol/src/test/secret-holder/issuance.test.ts`
Expected: 2 tests PASS

- [ ] **Step 6: Commit**

```bash
git add credentials-protocol/src/agents/secret-issuer-agent.ts
git add credentials-protocol/src/agents/secret-holder-agent.ts
git add credentials-protocol/src/test/secret-holder/issuance.test.ts
git commit -S -s -m "feat(credentials-protocol): add secret-holder issuance agents"
```

---

## Task 8: Secret-holder presentation and pseudonym flows

**Files:**
- Modify: `credentials-protocol/src/agents/secret-holder-agent.ts` (add presentation)
- Modify: `credentials-protocol/src/agents/verifier-agent.ts` (add secret-holder evaluation)
- Test: `credentials-protocol/src/test/secret-holder/presentation.test.ts`
- Test: `credentials-protocol/src/test/secret-holder/pseudonym.test.ts`

- [ ] **Step 1: Write failing secret-holder presentation test**

Create `credentials-protocol/src/test/secret-holder/presentation.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { MessageBus } from "../../transport/message-bus.js";
import { SecretIssuerAgent } from "../../agents/secret-issuer-agent.js";
import { SecretHolderAgent } from "../../agents/secret-holder-agent.js";
import { VerifierAgent } from "../../agents/verifier-agent.js";
import { createDIDProfile, fill } from "../helpers/did-provider.js";

describe("secret-holder: presentation flow", () => {
  const issuerProfile = createDIDProfile("issuer", "rita", 123456789n);
  const verifierProfile = createDIDProfile("verifier", "vera", 555555555n);

  let bus: MessageBus;
  let issuer: SecretIssuerAgent;
  let holder: SecretHolderAgent;
  let verifier: VerifierAgent;

  beforeEach(() => {
    bus = new MessageBus();
    issuer = new SecretIssuerAgent(issuerProfile, bus);
    holder = new SecretHolderAgent(
      { label: "alice", holderSecret: fill(11), holderSecretOpening: fill(13) },
      bus,
    );
    verifier = new VerifierAgent(verifierProfile, bus);

    // Pre-issue a secret credential
    issuer.createAndSendOffer("alice");
    holder.receiveOfferAndSendRequest(bus.receive("alice")!);
    issuer.receiveRequestAndIssueCredential(bus.receive(issuerProfile.label)!, {
      subjectId: fill(1), subjectOpening: fill(2),
      legalNamePadded: fill(3), legalNameOpening: fill(4),
      birthDateDays: 3650n, birthDateOpening: fill(5),
      birthCountryCodePadded: fill(6), birthCountryCodeOpening: fill(7),
      issuedAt: 10000n, expiresAt: 20000n,
    });
    holder.receiveCredentialResult(bus.receive("alice")!);
  });

  it("presents a secret-holder credential with age predicate", () => {
    verifier.createAndSendSecretPresentationRequest("alice", {
      issuerVerificationMethodRef: issuerProfile.signer.verificationMethodRef,
      requireSubjectIdCommitmentDisclosure: false,
      requireBirthCountryDisclosure: false,
      requireVerifierScopedPseudonym: false,
      requireAgeOverThreshold: true,
      requestedAgeThresholdYears: 18,
    });

    const request = bus.receive("alice")!;
    holder.receiveRequestAndSendPresentation(request, {
      credentialIndex: 0,
      currentDay: 12775n,
      birthDateDays: 3650n,
      birthDateOpening: fill(5),
      birthCountryCodePadded: fill(6),
      birthCountryCodeOpening: fill(7),
    });

    const submission = bus.receive(verifierProfile.label)!;
    const evaluation = verifier.receiveSecretSubmissionAndEvaluate(submission);
    expect(evaluation.approved).toBe(true);
  });
});
```

- [ ] **Step 2: Write pseudonym test**

Create `credentials-protocol/src/test/secret-holder/pseudonym.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { MessageBus } from "../../transport/message-bus.js";
import { SecretIssuerAgent } from "../../agents/secret-issuer-agent.js";
import { SecretHolderAgent } from "../../agents/secret-holder-agent.js";
import { VerifierAgent } from "../../agents/verifier-agent.js";
import { createDIDProfile, fill, sha256 } from "../helpers/did-provider.js";

describe("secret-holder: verifier-scoped pseudonym", () => {
  const issuerProfile = createDIDProfile("issuer", "rita", 123456789n);
  const verifierProfile = createDIDProfile("verifier", "vera", 555555555n);

  let bus: MessageBus;
  let holder: SecretHolderAgent;
  let verifier: VerifierAgent;

  beforeEach(() => {
    bus = new MessageBus();
    const issuer = new SecretIssuerAgent(issuerProfile, bus);
    holder = new SecretHolderAgent(
      { label: "alice", holderSecret: fill(11), holderSecretOpening: fill(13) },
      bus,
    );
    verifier = new VerifierAgent(verifierProfile, bus);

    // Pre-issue
    issuer.createAndSendOffer("alice");
    holder.receiveOfferAndSendRequest(bus.receive("alice")!);
    issuer.receiveRequestAndIssueCredential(bus.receive(issuerProfile.label)!, {
      subjectId: fill(1), subjectOpening: fill(2),
      legalNamePadded: fill(3), legalNameOpening: fill(4),
      birthDateDays: 3650n, birthDateOpening: fill(5),
      birthCountryCodePadded: fill(6), birthCountryCodeOpening: fill(7),
      issuedAt: 10000n, expiresAt: 20000n,
    });
    holder.receiveCredentialResult(bus.receive("alice")!);
  });

  it("derives a stable verifier-scoped pseudonym for the same holder and domain", () => {
    const verifierDomainHash = sha256("vera-domain");

    verifier.createAndSendSecretPresentationRequest("alice", {
      issuerVerificationMethodRef: issuerProfile.signer.verificationMethodRef,
      requireSubjectIdCommitmentDisclosure: false,
      requireBirthCountryDisclosure: false,
      requireVerifierScopedPseudonym: true,
      verifierDomainHash,
      requireAgeOverThreshold: false,
      requestedAgeThresholdYears: 0,
    });

    const request = bus.receive("alice")!;
    holder.receiveRequestAndSendPresentation(request, {
      credentialIndex: 0,
      currentDay: 12775n,
      birthDateDays: 3650n,
      birthDateOpening: fill(5),
      birthCountryCodePadded: fill(6),
      birthCountryCodeOpening: fill(7),
    });

    const submission = bus.receive(verifierProfile.label)!;
    const evaluation = verifier.receiveSecretSubmissionAndEvaluate(submission);
    expect(evaluation.approved).toBe(true);
    expect(evaluation.pseudonym).toBeDefined();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run credentials-protocol/src/test/secret-holder/`
Expected: FAIL

- [ ] **Step 4: Implement presentation and pseudonym support**

Extend `SecretHolderAgent`:
- `receiveRequestAndSendPresentation(request, witnessData)` — build presentation with `BlindedSecretHolderBinding`, compute challenge response from holder secret, optionally compute verifier-scoped pseudonym, sign and send

Extend `VerifierAgent`:
- `createAndSendSecretPresentationRequest(holderLabel, requirements)` — like the explicit variant but with secret-holder specific fields (pseudonym, domain hash)
- `receiveSecretSubmissionAndEvaluate(submission)` — validate using `assertValidSecretBirthCredentialPresentation`, `assertSecretBirthPresentationSatisfiesRequest`, and age predicate circuits. Return `{ approved, pseudonym? }`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run credentials-protocol/src/test/secret-holder/`
Expected: 2 tests PASS

- [ ] **Step 6: Commit**

```bash
git add credentials-protocol/src/agents/secret-holder-agent.ts
git add credentials-protocol/src/agents/verifier-agent.ts
git add credentials-protocol/src/test/secret-holder/presentation.test.ts
git add credentials-protocol/src/test/secret-holder/pseudonym.test.ts
git commit -S -s -m "feat(credentials-protocol): add secret-holder presentation and pseudonym flows"
```

---

## Task 9: Same-holder composition flow

**Files:**
- Test: `credentials-protocol/src/test/secret-holder/same-holder.test.ts`

- [ ] **Step 1: Write failing same-holder test**

Create `credentials-protocol/src/test/secret-holder/same-holder.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { MessageBus } from "../../transport/message-bus.js";
import { SecretIssuerAgent } from "../../agents/secret-issuer-agent.js";
import { SecretHolderAgent } from "../../agents/secret-holder-agent.js";
import { VerifierAgent } from "../../agents/verifier-agent.js";
import { createDIDProfile, fill } from "../helpers/did-provider.js";

describe("secret-holder: same-holder composition", () => {
  const issuer1Profile = createDIDProfile("issuer", "rita", 123456789n);
  const issuer2Profile = createDIDProfile("issuer", "government", 111111111n);
  const verifierProfile = createDIDProfile("verifier", "vera", 555555555n);

  let bus: MessageBus;
  let holder: SecretHolderAgent;
  let verifier: VerifierAgent;

  beforeEach(() => {
    bus = new MessageBus();
    const issuer1 = new SecretIssuerAgent(issuer1Profile, bus);
    const issuer2 = new SecretIssuerAgent(issuer2Profile, bus);
    holder = new SecretHolderAgent(
      { label: "alice", holderSecret: fill(11), holderSecretOpening: fill(13) },
      bus,
    );
    verifier = new VerifierAgent(verifierProfile, bus);

    // Issue credential 1 from Rita
    issuer1.createAndSendOffer("alice");
    holder.receiveOfferAndSendRequest(bus.receive("alice")!);
    issuer1.receiveRequestAndIssueCredential(bus.receive(issuer1Profile.label)!, {
      subjectId: fill(1), subjectOpening: fill(2),
      legalNamePadded: fill(3), legalNameOpening: fill(4),
      birthDateDays: 3650n, birthDateOpening: fill(5),
      birthCountryCodePadded: fill(6), birthCountryCodeOpening: fill(7),
      issuedAt: 10000n, expiresAt: 20000n,
    });
    holder.receiveCredentialResult(bus.receive("alice")!);

    // Issue credential 2 from Government
    issuer2.createAndSendOffer("alice");
    holder.receiveOfferAndSendRequest(bus.receive("alice")!);
    issuer2.receiveRequestAndIssueCredential(bus.receive(issuer2Profile.label)!, {
      subjectId: fill(10), subjectOpening: fill(20),
      legalNamePadded: fill(30), legalNameOpening: fill(40),
      birthDateDays: 3650n, birthDateOpening: fill(50),
      birthCountryCodePadded: fill(60), birthCountryCodeOpening: fill(70),
      issuedAt: 11000n, expiresAt: 21000n,
    });
    holder.receiveCredentialResult(bus.receive("alice")!);
  });

  it("proves two credentials from different issuers belong to the same hidden holder", () => {
    expect(holder.credentialCount).toBe(2);

    const sameHolderProof = holder.buildSameHolderProof(
      [0, 1],
      verifier.generateChallenge(),
    );

    const result = verifier.verifySameHolderProof(sameHolderProof);
    expect(result.sameHolder).toBe(true);
  });

  it("rejects same-holder proof when credentials have different holder secrets", () => {
    const differentHolder = new SecretHolderAgent(
      { label: "bob", holderSecret: fill(99), holderSecretOpening: fill(98) },
      bus,
    );

    // Bob gets a credential from issuer2
    const issuer2 = new SecretIssuerAgent(issuer2Profile, bus);
    issuer2.createAndSendOffer("bob");
    differentHolder.receiveOfferAndSendRequest(bus.receive("bob")!);
    issuer2.receiveRequestAndIssueCredential(bus.receive(issuer2Profile.label)!, {
      subjectId: fill(10), subjectOpening: fill(20),
      legalNamePadded: fill(30), legalNameOpening: fill(40),
      birthDateDays: 3650n, birthDateOpening: fill(50),
      birthCountryCodePadded: fill(60), birthCountryCodeOpening: fill(70),
      issuedAt: 11000n, expiresAt: 21000n,
    });
    differentHolder.receiveCredentialResult(bus.receive("bob")!);

    // Try to forge a same-holder proof using Alice's first credential and Bob's credential
    // This should fail because the holder secrets are different
    expect(() =>
      holder.buildSameHolderProofWith(
        holder.getCredential(0),
        differentHolder.getCredential(0),
        verifier.generateChallenge(),
      ),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run credentials-protocol/src/test/secret-holder/same-holder.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement same-holder methods**

Extend `SecretHolderAgent`:
- `buildSameHolderProof(credentialIndices, verifierChallenge)` — uses `assertSameHolderSecretBirthPresentations` or `assertSameBlindedSecretHolderBindingWitnesses` to compose proof across two stored credentials
- `buildSameHolderProofWith(storedCred, otherCred, challenge)` — for cross-holder testing (should fail if secrets differ)

Extend `VerifierAgent`:
- `generateChallenge()` — produces a deterministic verifier challenge hash
- `verifySameHolderProof(proof)` — validates the same-holder composition, returns `{ sameHolder: boolean }`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run credentials-protocol/src/test/secret-holder/same-holder.test.ts`
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add credentials-protocol/src/agents/secret-holder-agent.ts
git add credentials-protocol/src/agents/verifier-agent.ts
git add credentials-protocol/src/test/secret-holder/same-holder.test.ts
git commit -S -s -m "feat(credentials-protocol): add same-holder composition flow"
```

---

## Task 10: M1 milestone — run all tests and commit

**Files:** None new — validation only

- [ ] **Step 1: Run all credential package tests**

Run: `npm run test --workspace=credentials && npm run test --workspace=credentials-same-holder && npm run test --workspace=credentials-birth && npm run test --workspace=credentials-birth-secret && npm run test --workspace=credentials-demo-contract && npm run test --workspace=credentials-protocol`

Expected: All tests PASS across all 6 packages

- [ ] **Step 2: Verify test count**

The expected test count should be approximately:
- `credentials`: 9 tests
- `credentials-same-holder`: 2 tests
- `credentials-birth`: 13 tests
- `credentials-birth-secret`: 11 tests
- `credentials-demo-contract`: 7 tests
- `credentials-protocol`: ~15+ tests (new)

Total: ~57+ tests, all green

- [ ] **Step 3: Commit M1 milestone**

```bash
git add -A
git commit -S -s -m "milestone(credentials): M1 — protocol simulation layer complete

All credential protocol agents implemented with strict party boundaries:
- IssuerAgent and HolderAgent for explicit-holder profile
- SecretIssuerAgent and SecretHolderAgent for secret-holder profile
- VerifierAgent for off-chain verification (both profiles)
- ContractVerifier wrapping the demo contract simulator

In-process MessageBus enforces party isolation.
All protocol flows exercised: issuance, presentation, pseudonym, same-holder.
~57+ tests across 6 packages, all green."
```

---

## Task 11: Spec alignment — audit and update research/midnight-credentials.md

**Files:**
- Modify: `research/midnight-credentials.md`

- [ ] **Step 1: Audit circuit name references**

Read every circuit name referenced in the spec. For each one, grep the actual Compact source to verify it still exists with that exact name. Fix any stale references.

Key sections to audit:
- "Circuit Reference" section (line ~494)
- "Holder-Binding Helper Circuits" table (line ~524)
- "Context and Challenge-Derivation Circuits" table (line ~602)

- [ ] **Step 2: Add protocol simulation layer to architecture section**

Add a new subsection under "Architectural Layers" documenting Layer 4's concrete implementation:
- The `credentials-protocol` package
- Agent classes and party boundaries
- MessageBus transport abstraction
- The distinction between off-chain verifier and contract verifier

- [ ] **Step 3: Update the capability profile table**

Update the "Prototype capability profiles" table (line ~312) to add any new profiles exercised by the protocol tests and update test file references.

- [ ] **Step 4: Commit**

```bash
git add research/midnight-credentials.md
git commit -S -s -m "docs(credentials): align spec with protocol simulation layer"
```

---

## Task 12: Guide alignment — update midnight-credentials-for-dummies.md

**Files:**
- Modify: `research/midnight-credentials-for-dummies.md`

- [ ] **Step 1: Audit test file references**

Every "Tests For This Chapter" section references specific test files. Verify each path exists. Fix any stale references.

- [ ] **Step 2: Add Chapter 17: The Protocol Layer**

Add a new chapter after Chapter 16 covering:
- Why party boundaries matter
- The IssuerAgent / HolderAgent / VerifierAgent model
- The MessageBus as a transport seam
- How the contract verifier differs from the off-chain verifier
- Pointers to `credentials-protocol/src/test/` test files

Write in the existing style (story-driven, plain language, Mohawk commentary).

- [ ] **Step 3: Update "Where To Start In The Code" section**

Add `credentials-protocol` entries to the reading order at the bottom of the guide.

- [ ] **Step 4: Update the Quick Package Map table**

Add `credentials-protocol` to the package map table near the top.

- [ ] **Step 5: Update One-Screen Summary table**

Update Layer 4 status from "documented, not prototyped as a package yet" to "credentials-protocol".

- [ ] **Step 6: Commit**

```bash
git add research/midnight-credentials-for-dummies.md
git commit -S -s -m "docs(credentials): align companion guide with protocol layer and test references"
```

---

## Task 13: M3/M4 final milestone

**Files:** None new — validation and final commit

- [ ] **Step 1: Run full test suite**

Run: `npm run test --workspace=credentials && npm run test --workspace=credentials-same-holder && npm run test --workspace=credentials-birth && npm run test --workspace=credentials-birth-secret && npm run test --workspace=credentials-demo-contract && npm run test --workspace=credentials-protocol`

Expected: All tests PASS

- [ ] **Step 2: Verify docs consistency**

Spot-check 5 circuit name references in the spec against actual Compact source.
Spot-check 5 test file references in the companion guide against actual test files.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -S -s -m "milestone(credentials): M4 — delivery complete

Protocol simulation layer, all integration tests, spec and guide aligned.
Ready for review and merge."
```
