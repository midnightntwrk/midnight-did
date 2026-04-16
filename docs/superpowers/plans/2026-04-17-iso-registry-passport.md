# ISO Registry + Passport Credential — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a shared ISO code registry and the passport credential family (explicit + secret holder variants) as the second Midnight credential family, validating the credential family template pattern.

**Architecture:** Three new packages: `credentials-iso-registry` (Compact types for numeric ISO codes), `credentials-passport` (explicit DID holder binding), `credentials-passport-secret` (blinded secret holder binding). The passport family follows the exact same modular Compact structure as the existing birth credential, importing shared claims across both holder variants. Each family owns its own predicates (age, expiry).

**Tech Stack:** Compact smart contracts, TypeScript, Vitest, compact-runtime pureCircuits

**Spec:** `docs/superpowers/specs/2026-04-17-iso-registry-passport-design.md`

---

## File Structure

```
credentials-iso-registry/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── eslint.config.mjs
├── vitest.config.ts
├── scripts/
│   ├── align-runtime-version.mjs
│   └── strip-managed-sourcemaps.mjs
├── src/
│   ├── iso-registry.compact
│   ├── iso-registry/
│   │   └── codes.compact
│   ├── index.ts
│   └── test/
│       └── iso-codes.test.ts

credentials-passport/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── eslint.config.mjs
├── vitest.config.ts
├── scripts/
│   ├── align-runtime-version.mjs
│   └── strip-managed-sourcemaps.mjs
├── src/
│   ├── passport-credential.compact
│   ├── passport-credential/
│   │   ├── claims.compact
│   │   ├── model.compact
│   │   ├── validation.compact
│   │   ├── protocol-model.compact
│   │   └── helpers.compact
│   ├── index.ts
│   └── test/
│       ├── credential-fixtures.ts
│       ├── holder-binding.test.ts
│       ├── capability-profiles.test.ts
│       ├── predicates.test.ts
│       └── protocol.test.ts

credentials-passport-secret/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── eslint.config.mjs
├── vitest.config.ts
├── scripts/
│   ├── align-runtime-version.mjs
│   └── strip-managed-sourcemaps.mjs
├── src/
│   ├── secret-passport-credential.compact
│   ├── secret-passport-credential/
│   │   ├── model.compact
│   │   ├── validation.compact
│   │   ├── protocol-model.compact
│   │   └── helpers.compact
│   ├── index.ts
│   └── test/
│       ├── credential-fixtures.ts
│       ├── holder-binding.test.ts
│       ├── capability-profiles.test.ts
│       ├── predicates.test.ts
│       └── same-holder-composition.test.ts
```

---

## Task 1: Scaffold and implement `credentials-iso-registry`

**Files:**
- Create: all files under `credentials-iso-registry/`
- Modify: `package.json` (root — add workspace)

This task creates the entire ISO registry package including Compact contract, tests, and build infrastructure.

- [ ] **Step 1: Create package scaffold**

Create `credentials-iso-registry/package.json` following the `credentials-birth/package.json` pattern. Key differences:
- Name: `@midnight-ntwrk/midnight-did-credentials-iso-registry`
- Compact command: `compact compile src/iso-registry.compact src/managed/iso-registry`
- Build copies: `./src/managed`, `./src/iso-registry.compact`, `./src/iso-registry/`
- Dependencies: only `@midnight-ntwrk/compact-runtime`

Create `tsconfig.json`, `tsconfig.build.json`, `eslint.config.mjs`, `vitest.config.ts` — copy exactly from `credentials-birth/`.

Create `scripts/align-runtime-version.mjs` — copy from `credentials-birth/scripts/align-runtime-version.mjs` and replace `birth-credential` with `iso-registry` in the target path.

Create `scripts/strip-managed-sourcemaps.mjs` — copy from `credentials-birth/scripts/strip-managed-sourcemaps.mjs` unchanged.

Add `"credentials-iso-registry"` to root `package.json` workspaces array, before `"credentials-birth"`.

- [ ] **Step 2: Create Compact contract**

Create `credentials-iso-registry/src/iso-registry.compact`:
```compact
pragma language_version >= 0.20;

import CompactStandardLibrary;

include "./iso-registry/codes";
```

Create `credentials-iso-registry/src/iso-registry/codes.compact`:
```compact
export struct CountryCode {
  value: Uint<16>
}

export struct CurrencyCode {
  value: Uint<16>
}

export struct LanguageCode {
  value: Uint<16>
}

export struct RegionCode {
  country: Uint<16>,
  subdivision: Uint<16>
}

export struct GenderCode {
  value: Uint<8>
}

export circuit assertCountryEquals(
  actual: CountryCode,
  expected: Uint<16>
): [] {
  assert(actual.value == expected, "Country code does not match expected value");
}

export circuit assertRegionCountryEquals(
  region: RegionCode,
  expectedCountry: Uint<16>
): [] {
  assert(region.country == expectedCountry, "Region country does not match expected value");
}
```

Create `credentials-iso-registry/src/index.ts`:
```typescript
export * from "./managed/iso-registry/contract/index.js";
export * as IsoRegistryContract from "./managed/iso-registry/contract/index.js";
```

- [ ] **Step 3: Compile and verify**

Run: `npm install && npm run compact --workspace=credentials-iso-registry`
Expected: Compact compiles successfully, managed artifacts generated

- [ ] **Step 4: Write tests**

Create `credentials-iso-registry/src/test/iso-codes.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { pureCircuits } from "../managed/iso-registry/contract/index.js";

describe("ISO code types and assertions", () => {
  it("constructs a CountryCode and passes equality assertion", () => {
    const germany = { value: 276n };
    expect(() => pureCircuits.assertCountryEquals(germany, 276n)).not.toThrow();
  });

  it("rejects mismatching country code", () => {
    const germany = { value: 276n };
    expect(() => pureCircuits.assertCountryEquals(germany, 840n)).toThrow(
      /Country code does not match/,
    );
  });

  it("constructs a RegionCode and passes country assertion", () => {
    const california = { country: 840n, subdivision: 6n };
    expect(() =>
      pureCircuits.assertRegionCountryEquals(california, 840n),
    ).not.toThrow();
  });

  it("rejects mismatching region country", () => {
    const california = { country: 840n, subdivision: 6n };
    expect(() =>
      pureCircuits.assertRegionCountryEquals(california, 276n),
    ).toThrow(/Region country does not match/);
  });

  it("constructs GenderCode with ISO 5218 values", () => {
    const male = { value: 1n };
    const female = { value: 2n };
    const notApplicable = { value: 9n };
    // These are struct constructions — verify they round-trip
    expect(male.value).toBe(1n);
    expect(female.value).toBe(2n);
    expect(notApplicable.value).toBe(9n);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm run test --workspace=credentials-iso-registry`
Expected: 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add credentials-iso-registry/ package.json
git commit -S -s -m "feat(credentials-iso-registry): add shared ISO code types for credential families"
```

---

## Task 2: Scaffold `credentials-passport` package

**Files:**
- Create: `credentials-passport/package.json`, config files, scripts
- Modify: `package.json` (root — add workspace)

- [ ] **Step 1: Create package scaffold**

Create `credentials-passport/package.json` following `credentials-birth/package.json`:
- Name: `@midnight-ntwrk/midnight-did-credentials-passport`
- Compact command: `compact compile src/passport-credential.compact src/managed/passport-credential`
- Build copies: managed, `.compact`, `./src/passport-credential/`
- Dependencies: `compact-runtime`, `midnight-did-credentials`, `midnight-did-credentials-iso-registry`

Create `tsconfig.json`, `tsconfig.build.json`, `eslint.config.mjs`, `vitest.config.ts` — copy from `credentials-birth/`.

Create `scripts/align-runtime-version.mjs` — copy from birth, replace `birth-credential` with `passport-credential`.

Create `scripts/strip-managed-sourcemaps.mjs` — copy unchanged.

Create `credentials-passport/src/index.ts`:
```typescript
export * from "./managed/passport-credential/contract/index.js";
export * as PassportCredentialContract from "./managed/passport-credential/contract/index.js";
```

Add `"credentials-passport"` to root `package.json` workspaces, after `"credentials-iso-registry"`.

- [ ] **Step 2: Run npm install**

Run: `npm install`

- [ ] **Step 3: Commit**

```bash
git add credentials-passport/ package.json
git commit -S -s -m "feat(credentials-passport): scaffold package"
```

---

## Task 3: Passport Compact contract — claims and model

**Files:**
- Create: `credentials-passport/src/passport-credential.compact`
- Create: `credentials-passport/src/passport-credential/claims.compact`
- Create: `credentials-passport/src/passport-credential/model.compact`

- [ ] **Step 1: Create claims.compact**

```compact
export struct PassportClaims {
  documentNumberCommitment: Bytes<32>,
  issuingCountry: CountryCode,
  nationalityCommitment: Bytes<32>,
  givenNameCommitment: Bytes<32>,
  familyNameCommitment: Bytes<32>,
  birthDateCommitment: Bytes<32>,
  genderCommitment: Bytes<32>,
  expiryDate: Uint<32>,
}

export circuit passportClaimRoot(claims: PassportClaims): Bytes<32> {
  return persistentHash<Vector<7, Bytes<32>>>([
    pad(32, "midnight:vc:passport:v1"),
    claims.documentNumberCommitment,
    claims.nationalityCommitment,
    claims.givenNameCommitment,
    claims.familyNameCommitment,
    claims.birthDateCommitment,
    claims.genderCommitment
  ]);
}

export circuit documentNumberCommitment(
  documentNumber: Bytes<32>, opening: Bytes<32>
): Bytes<32> {
  return persistentCommit<Bytes<32>>(documentNumber, opening);
}

export circuit nationalityCommitment(
  nationality: Uint<16>, opening: Bytes<32>
): Bytes<32> {
  return persistentCommit<Uint<16>>(nationality, opening);
}

export circuit givenNameCommitment(
  givenName: Bytes<32>, opening: Bytes<32>
): Bytes<32> {
  return persistentCommit<Bytes<32>>(givenName, opening);
}

export circuit familyNameCommitment(
  familyName: Bytes<32>, opening: Bytes<32>
): Bytes<32> {
  return persistentCommit<Bytes<32>>(familyName, opening);
}

export circuit passportBirthDateCommitment(
  birthDateDays: Uint<32>, opening: Bytes<32>
): Bytes<32> {
  return persistentCommit<Uint<32>>(birthDateDays, opening);
}

export circuit genderCommitment(
  gender: Uint<8>, opening: Bytes<32>
): Bytes<32> {
  return persistentCommit<Uint<8>>(gender, opening);
}
```

- [ ] **Step 2: Create model.compact**

```compact
export struct PassportDisclosures {
  revealNationality: Boolean,
  nationalityValue: Uint<16>,
  nationalityOpening: Bytes<32>,
  revealGender: Boolean,
  genderValue: Uint<8>,
  genderOpening: Bytes<32>,
  proveAgeOverThreshold: Boolean,
  ageThresholdYears: Uint<8>,
  proveNotExpired: Boolean,
}

export struct PassportPresentationRequest {
  version: Uint<16>,
  schema: SchemaRef,
  issuerVerificationMethodRef: VerificationMethodRef,
  requireNationalityDisclosure: Boolean,
  requireGenderDisclosure: Boolean,
  requireAgeOverThreshold: Boolean,
  requestedAgeThresholdYears: Uint<8>,
  requireNotExpired: Boolean,
  verifierChallengeHash: Bytes<32>,
}
```

- [ ] **Step 3: Create entry point passport-credential.compact**

```compact
pragma language_version >= 0.20;

import CompactStandardLibrary;

include "../../credentials/src/credentials";
include "../../credentials-iso-registry/src/iso-registry";
include "./passport-credential/claims";
include "./passport-credential/model";

import VC<PassportClaims, PassportDisclosures, ExplicitHolderBinding>;

export type PassportCredential = Credential;
export type PassportPresentation = Presentation;
include "./passport-credential/protocol-model";

import IssuanceProtocol<
  PassportIssuanceOfferBody,
  PassportIssuanceRequestBody,
  PassportIssuanceResultBody
> prefix PassportIssuance_;

import PresentationProtocol<
  PassportVerificationRequestBody,
  PassportVerificationSubmissionBody,
  PassportVerificationResultBody
> prefix PassportVerification_;

export type PassportIssuanceOffer = PassportIssuance_OfferMessage;
export type PassportIssuanceRequest = PassportIssuance_RequestMessage;
export type PassportIssuanceResult = PassportIssuance_ResultMessage;
export type PassportVerificationRequest = PassportVerification_RequestMessage;
export type PassportVerificationSubmission = PassportVerification_SubmissionMessage;
export type PassportVerificationResult = PassportVerification_ResultMessage;
include "./passport-credential/helpers";
include "./passport-credential/validation";
```

- [ ] **Step 4: Create protocol-model.compact**

Follow the birth credential `protocol-model.compact` pattern. Key differences:
- Body types prefixed with `Passport` instead of `BirthCredential`
- Verification request body has: `requireNationalityDisclosure`, `requireGenderDisclosure`, `requireAgeOverThreshold`, `requestedAgeThresholdYears`, `requireNotExpired`
- Result body has: `credentialRoot`, `verifiedThresholdYears`, `verifiedNotExpired`

- [ ] **Step 5: Create helpers.compact**

Follow the birth credential `helpers.compact` pattern:
- `passportCredentialBodyRoot(credential)` — delegates to `credentialBodyRoot(credential)`
- `passportCredentialPresentationBodyRoot(presentation)` — delegates to `presentationBodyRoot(presentation)`
- `passportPresentationRequestBodyRoot(request)` — hashes the request
- `assertValidPassportSchemaRef(schema)` — checks `"midnight-did:vc:passport"` and `"passport-credential:v1"`
- `assertValidPassportPresentationRequest(request)` — validates request fields
- `passportPresentationRequestFromProtocol(request)` — maps protocol request to presentation request

- [ ] **Step 6: Create validation.compact**

Follow the birth credential `validation.compact` pattern. The passport variant adds:
- `assertPassportNotExpired(credential, currentDay)` — `assert(currentDay <= credential.claims.expiryDate, "Passport has expired")`
- `assertValidPassportAgePredicate(credential, presentation, currentDay, birthDateDays, birthDateOpening)` — same logic as birth age predicate but uses `passportBirthDateCommitment`
- Nationality disclosure validation: checks `nationalityCommitment(presentation.disclosed.nationalityValue, presentation.disclosed.nationalityOpening) == credential.claims.nationalityCommitment`
- Gender disclosure validation: checks `genderCommitment(presentation.disclosed.genderValue, presentation.disclosed.genderOpening) == credential.claims.genderCommitment`

All issuance/verification protocol validation circuits follow the same pattern as birth, with `Passport` prefixes and `passport`-specific field checks.

- [ ] **Step 7: Compile**

Run: `npm run compact --workspace=credentials-passport`
Expected: successful compilation

- [ ] **Step 8: Commit**

```bash
git add credentials-passport/src/
git commit -S -s -m "feat(credentials-passport): add passport Compact contract with claims, model, and validation"
```

---

## Task 4: Passport test fixtures and tests

**Files:**
- Create: `credentials-passport/src/test/credential-fixtures.ts`
- Create: `credentials-passport/src/test/holder-binding.test.ts`
- Create: `credentials-passport/src/test/capability-profiles.test.ts`
- Create: `credentials-passport/src/test/predicates.test.ts`
- Create: `credentials-passport/src/test/protocol.test.ts`

- [ ] **Step 1: Create credential-fixtures.ts**

Follow the `credentials-birth/src/test/credential-fixtures.ts` pattern exactly. Key differences:
- Import from `../managed/passport-credential/contract/index.js`
- `PassportCredentialFixture` type with passport-specific witness fields: `documentNumber`, `documentNumberOpening`, `nationality` (Uint16), `nationalityOpening`, `givenName`, `givenNameOpening`, `familyName`, `familyNameOpening`, `birthDateDays`, `birthDateOpening`, `gender` (Uint8), `genderOpening`, `expiryDate`, `currentDay`
- `createPassportCredentialFixture()` builds credential with `issuingCountry: { value: 276n }` (Germany), `nationality: 276n`, `expiryDate: 25000n`, `gender: 2n` (female), `birthDateDays: 3650n`
- Schema: `packageId: "midnight-did:vc:passport"`, `schemaId: "passport-credential:v1"`
- Disclosure includes nationality and gender reveal + age threshold + expiry check
- Protocol fixture extends with passport-specific protocol messages

- [ ] **Step 2: Create holder-binding.test.ts**

3 tests following birth pattern:
- "binds the issuer proof to the passport credential body"
- "binds the holder proof to the passport presentation body"
- "enforces a verifier-defined passport presentation request"

- [ ] **Step 3: Create capability-profiles.test.ts**

3 tests:
- "supports the simplest issuer-attested passport credential flow"
- "supports an operational flow with nationality disclosure and age predicate"
- "supports a flow with nationality, gender disclosure, age predicate, and expiry check"

- [ ] **Step 4: Create predicates.test.ts**

4 tests:
- "validates age predicate against birth date witness"
- "rejects age predicate when holder is below threshold"
- "validates passport not-expired predicate"
- "rejects presentation when passport has expired"

- [ ] **Step 5: Create protocol.test.ts**

4 tests following birth protocol test pattern:
- "maps a protocol verification request into the concrete presentation request shape"
- "accepts a concrete issuance flow aligned to the generic protocol thread model"
- "rejects an issuance result when the holder binding does not match"
- "accepts a concrete verification flow aligned to the protocol thread model"

- [ ] **Step 6: Run all tests**

Run: `npm run test --workspace=credentials-passport`
Expected: ~14 tests PASS

- [ ] **Step 7: Commit**

```bash
git add credentials-passport/src/test/
git commit -S -s -m "feat(credentials-passport): add test fixtures and tests for explicit-holder passport"
```

---

## Task 5: Scaffold and implement `credentials-passport-secret`

**Files:**
- Create: all files under `credentials-passport-secret/`
- Modify: `package.json` (root — add workspace)

- [ ] **Step 1: Create package scaffold**

Same pattern as `credentials-birth-secret/`:
- Name: `@midnight-ntwrk/midnight-did-credentials-passport-secret`
- Compact command: `compact compile src/secret-passport-credential.compact src/managed/secret-passport-credential`
- Dependencies: `compact-runtime`, `midnight-did-credentials`, `midnight-did-credentials-iso-registry`, `midnight-did-credentials-passport`, `midnight-did-credentials-same-holder`

Add to root workspaces after `"credentials-passport"`.

- [ ] **Step 2: Create Compact contract**

Follow `credentials-birth-secret/src/secret-birth-credential.compact` pattern:

Entry point `secret-passport-credential.compact`:
- Includes: credentials, same-holder, iso-registry, passport claims
- Includes local: model, protocol-model, helpers, validation
- Imports `VC<PassportClaims, SecretPassportDisclosures, BlindedSecretHolderBinding>`
- Instantiates `IssuanceProtocol` and `PresentationProtocol` with secret passport body types

`secret-passport-credential/model.compact`:
- `SecretPassportDisclosures` — adds `revealVerifierScopedPseudonym` and `verifierScopedPseudonym` fields to the passport disclosure set
- `SecretPassportPresentationRequest` — adds `requireVerifierScopedPseudonym` and `verifierDomainHash` to the passport request

`secret-passport-credential/validation.compact`:
- Same structure as `credentials-birth-secret/validation.compact` but for passport types
- Uses `BlindedSecretHolderBinding` circuits
- Includes pseudonym validation
- Includes same-holder composition circuit
- Owns its own age predicate and expiry predicate

`secret-passport-credential/helpers.compact`:
- Body root, presentation body root, schema validation
- Request mapping from protocol to presentation request

`secret-passport-credential/protocol-model.compact`:
- Secret passport issuance/verification body types

- [ ] **Step 3: Compile**

Run: `npm run compact --workspace=credentials-passport-secret`
Expected: successful compilation

- [ ] **Step 4: Create test fixtures and tests**

Follow `credentials-birth-secret/src/test/` pattern:

`credential-fixtures.ts`:
- `SecretPassportCredentialFixtureOptions` with all customizable fields
- `createSecretPassportCredentialFixture(options)` factory

`holder-binding.test.ts` (4 tests):
- Issuer proof binds to secret credential body
- Wrong holder secret rejected
- Wrong verifier challenge rejected
- Verifier-scoped pseudonym derivation

`capability-profiles.test.ts` (3 tests):
- Minimal privacy flow
- Hidden-holder with age predicate
- Advanced: all features (pseudonym + nationality + gender + age + expiry)

`predicates.test.ts` (2 tests):
- Age predicate with secret binding
- Expiry predicate with secret binding

`same-holder-composition.test.ts` (2 tests):
- Same holder accepted
- Different holder rejected

- [ ] **Step 5: Run all tests**

Run: `npm run test --workspace=credentials-passport-secret`
Expected: ~11 tests PASS

- [ ] **Step 6: Commit**

```bash
git add credentials-passport-secret/ package.json
git commit -S -s -m "feat(credentials-passport-secret): add secret-holder passport credential with tests"
```

---

## Task 6: Full regression test and push

- [ ] **Step 1: Run all tests across all packages**

```bash
npm run test --workspace=credentials
npm run test --workspace=credentials-same-holder
npm run test --workspace=credentials-birth
npm run test --workspace=credentials-birth-secret
npm run test --workspace=credentials-demo-contract
npm run test --workspace=credentials-protocol
npm run test --workspace=credentials-iso-registry
npm run test --workspace=credentials-passport
npm run test --workspace=credentials-passport-secret
```

Expected: All packages pass. Total should be ~92+ tests (63 existing + ~29 new).

- [ ] **Step 2: Push**

```bash
git push
```
