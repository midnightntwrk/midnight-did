# ISO Registry + Passport Credential Design

Date: 2026-04-17

Status: Approved

## Context

The Midnight Credentials system currently has one credential family (birth) in two holder-binding variants. The test strategy defines five additional families. This spec covers the first expansion: a shared ISO registry package and the passport credential family (both explicit and secret holder variants).

## Delivery Scope

### In scope

1. `credentials-iso-registry` — Compact types for ISO country, region, currency, language, gender codes
2. `credentials-passport` — Passport credential with explicit DID holder binding
3. `credentials-passport-secret` — Passport credential with blinded secret holder binding
4. Tests for all three packages (~29 new tests)

### Out of scope

- Migrating existing birth credential to use ISO registry types (future)
- Other credential families (National ID, Driving License, Employee, AML/KYC)
- Use case contracts
- Protocol agent tests for passport (will reuse existing agent infrastructure)

## Package: `credentials-iso-registry`

### Structure

```
credentials-iso-registry/
├── package.json
├── tsconfig.json
├── eslint.config.mjs
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
```

### Types (codes.compact)

```compact
export struct CountryCode { value: Uint<16> }
export struct CurrencyCode { value: Uint<16> }
export struct LanguageCode { value: Uint<16> }
export struct RegionCode { country: Uint<16>, subdivision: Uint<16> }
export struct GenderCode { value: Uint<8> }
```

All types use numeric values per the corresponding ISO standard:
- CountryCode: ISO 3166-1 numeric (e.g., 276 = DE, 840 = US)
- CurrencyCode: ISO 4217 numeric (e.g., 978 = EUR, 840 = USD)
- LanguageCode: custom numeric mapping (e.g., 1 = en, 2 = de)
- RegionCode: ISO 3166-2 as country + subdivision pair
- GenderCode: ISO 5218 (0 = not known, 1 = male, 2 = female, 9 = not applicable)

### Assertion circuits

```compact
export circuit assertCountryEquals(
  actual: CountryCode, expected: Uint<16>
): []

export circuit assertRegionCountryEquals(
  region: RegionCode, expectedCountry: Uint<16>
): []
```

### Dependencies

- `@midnight-ntwrk/compact-runtime`: *

### Tests (~5)

- CountryCode struct construction and equality
- RegionCode struct construction and country extraction
- assertCountryEquals passes for matching code
- assertCountryEquals rejects for mismatching code
- assertRegionCountryEquals passes and rejects

## Package: `credentials-passport`

### Structure

```
credentials-passport/
├── package.json
├── tsconfig.json
├── eslint.config.mjs
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
```

### Claims (claims.compact)

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
```

Public fields: `issuingCountry`, `expiryDate`
Committed fields: all others

Commitment circuits:
- `documentNumberCommitment(documentNumber, opening)`
- `nationalityCommitment(nationality: Uint<16>, opening)` — commits the numeric country code
- `givenNameCommitment(givenName, opening)`
- `familyNameCommitment(familyName, opening)`
- `passportBirthDateCommitment(birthDateDays: Uint<32>, opening)`
- `genderCommitment(gender: Uint<8>, opening)`
- `passportClaimRoot(claims)` — domain-tagged hash with `"midnight:vc:passport:v1"`

### Disclosures (model.compact)

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

### Predicates (in validation.compact, owned by passport family)

- `assertValidPassportAgePredicate(credential, presentation, currentDay, birthDateDays, birthDateOpening)` — same logic as birth age predicate
- `assertPassportNotExpired(credential, currentDay)` — `currentDay <= credential.claims.expiryDate`

### Entry point (passport-credential.compact)

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
import IssuanceProtocol<...> prefix PassportIssuance_;
import PresentationProtocol<...> prefix PassportVerification_;

// type aliases
include "./passport-credential/helpers";
include "./passport-credential/validation";
```

### Dependencies

- `@midnight-ntwrk/compact-runtime`: *
- `@midnight-ntwrk/midnight-did-credentials`: *
- `@midnight-ntwrk/midnight-did-credentials-iso-registry`: *

### Tests (~13)

Following the birth credential test template:

- holder-binding (3): issuer proof binds, holder proof binds, verifier request enforced
- capability-profiles (3): simplest flow, operational flow with disclosure, strongest flow with all features
- predicates (3): age predicate passes, age predicate fails, expiry predicate passes, expiry predicate fails
- protocol (4): offer→request alignment, request→result alignment, verification flow alignment, mismatch rejected

## Package: `credentials-passport-secret`

### Structure

```
credentials-passport-secret/
├── package.json
├── tsconfig.json
├── eslint.config.mjs
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

### Differences from explicit variant

- Uses `BlindedSecretHolderBinding` instead of `ExplicitHolderBinding`
- Defines `SecretPassportDisclosures` with additional pseudonym fields
- Defines `SecretPassportPresentationRequest` with pseudonym and domain hash fields
- Imports `claims.compact` from `credentials-passport` (cross-package reuse)
- Includes same-holder composition test

### Dependencies

- `@midnight-ntwrk/compact-runtime`: *
- `@midnight-ntwrk/midnight-did-credentials`: *
- `@midnight-ntwrk/midnight-did-credentials-iso-registry`: *
- `@midnight-ntwrk/midnight-did-credentials-passport`: *
- `@midnight-ntwrk/midnight-did-credentials-same-holder`: *

### Tests (~11)

- holder-binding (4): issuer proof, wrong secret rejected, wrong challenge rejected, pseudonym derivation
- capability-profiles (3): minimal privacy, hidden-holder with age, advanced with all features
- predicates (2): age predicate, expiry predicate (with secret binding)
- same-holder-composition (2): same holder accepted, different holder rejected

## Design Decisions

### Why passport first (not national ID or driving license)

Passport is the closest to the existing birth credential — it has the same age predicate plus an expiry predicate. This makes it the simplest next step. It also validates the ISO registry integration without adding complex new predicate types (region match, category match, etc.).

### Why each family owns its predicates

Premature extraction of shared predicates creates coupling between credential families. Each family owns its age predicate, expiry check, and any family-specific predicates. We extract common patterns only when three or more families converge on identical logic.

### Why CountryCode in claims uses Uint<16> for commitment

The `nationalityCommitment` commits to `Uint<16>` (the numeric country code), not a padded `Bytes<32>`. This means the commitment circuit is `persistentCommit<Uint<16>>(value, opening)`. The verifier can check `disclosedNationality == 276` directly against the committed value.
