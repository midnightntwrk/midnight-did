# Midnight Credentials Test Strategy

Version: `0.2-draft`

Status: Draft — companion to `research/midnight-credentials.md`

## Purpose

This document defines the test strategy for the Midnight Verifiable Credentials system. It covers:

1. The configuration dimensions that produce the full combinatorial space
2. The credential families and their claim structures
3. The shared ISO registry for interoperable field values
4. Concrete use cases that exercise meaningful subsets of the combination space
5. The test matrix mapping every combination to a test scenario
6. The test pyramid: which layer owns which tests

## Architecture Recap

The Midnight Credentials system has five layers:

| Layer | Package(s) | What it owns |
|-------|-----------|--------------|
| 0 | `credentials-iso-registry` | Shared ISO code types (country, currency, language, region) |
| 1 | `credentials`, `credentials-same-holder` | Generic VC/VP envelope, proof, holder-binding profiles, protocol |
| 2 | `credentials-{family}`, `credentials-{family}-secret` | Concrete credential families (claims, disclosures, predicates, validation) |
| 3 | `credentials-demo-contract`, business contracts | Business logic, capabilities, state mutation |
| 4 | `credentials-protocol`, `standalone-environment` | Protocol simulation, party agents, integration infrastructure |

## Configuration Dimensions

Every credential interaction is a point in a multi-dimensional configuration space.

### Dimension 1: Credential Family

| Family | Package | Claims | ISO Codes Used |
|--------|---------|--------|----------------|
| Birth | `credentials-birth` | subjectId, legalName, birthDate, birthCountry | country (3166-1) |
| Passport | `credentials-passport` | documentNumber, issuingCountry, nationality, givenName, familyName, birthDate, gender, expiryDate | country (3166-1), gender (ISO 5218) |
| Driving License | `credentials-driving-license` | licenseNumber, issuingCountry, issuingRegion, holderName, birthDate, licenseCategory, validFrom, validUntil | country (3166-1), region (3166-2) |
| National ID | `credentials-national-id` | documentNumber, issuingCountry, givenName, familyName, birthDate, birthPlace, residenceRegion, taxIdentifier | country (3166-1), region (3166-2) |
| AML/KYC Compliance | `credentials-compliance` | subjectId, amlStatus, sanctionsScreening, pepStatus, riskScore, jurisdiction, checkedAt, validUntilDay | country (3166-1) |
| Employee | `credentials-employee` | employeeId, organizationName, organizationId, department, role, clearanceLevel, employedSince | — |

### Dimension 2: Holder Binding Profile

| Profile | Type | Privacy Level | Same-Holder Support |
|---------|------|---------------|---------------------|
| Explicit DID | `ExplicitHolderBinding` | Low — holder DID visible | No (trivial via DID match) |
| Blinded Secret | `BlindedSecretHolderBinding` | High — holder identity hidden | Yes (via shared secret witness) |

Note: `SecretHolderBinding` (non-blinded) exists in the generic layer but is not instantiated by any current credential family. It could serve as an intermediate profile if needed.

### Dimension 3: Selective Disclosure

Each credential family defines its own disclosure struct with per-field reveal flags.

| Disclosure Level | Meaning |
|-----------------|---------|
| None (predicate-only) | No raw claim values revealed — only predicate outcomes |
| Minimal (1 field) | Single field disclosed for structural matching |
| Selective (2-3 fields) | Multiple fields disclosed per verifier request |
| Full | All fields disclosed (not typical in privacy flows) |

### Dimension 4: Predicates

| Predicate Type | Applies To | Circuit Logic |
|----------------|-----------|---------------|
| Age >= threshold | birthDate claim | `currentDay - birthDateDays >= thresholdYears * 365` |
| Not expired | expiryDate / validUntil | `currentDay <= expiryDate` |
| Risk score <= threshold | riskScore claim | `riskScore <= threshold` |
| Freshness <= N days | checkedAt claim | `currentDay - checkedAt <= maxDays` |
| Category match | licenseCategory | `licenseCategory == requiredCategory` |
| Clearance >= level | clearanceLevel | `clearanceLevel >= requiredLevel` |
| Region match | residenceRegion | `residenceRegion.country == requiredCountry` |

### Dimension 5: Verifier-Scoped Pseudonym

| Option | When |
|--------|------|
| No pseudonym | Explicit holder, or privacy-maximal (no linkability at all) |
| Verifier-scoped | Secret holder — verifier needs pairwise local continuity |

### Dimension 6: Same-Holder Composition

| Composition | Credentials | Binding Requirement |
|-------------|------------|---------------------|
| Single | 1 | Any profile |
| Two-credential | 2 from different issuers | Blinded secret (shared holder secret) |
| Three-credential | 3 from different issuers | Blinded secret (extends same-holder pattern) |

### Dimension 7: Verifier Mode

| Mode | Implementation | State |
|------|---------------|-------|
| Off-chain agent | `VerifierAgent` | Stateless — evaluates and returns result |
| On-chain contract | `ContractVerifier` / business contract | Stateful — records, issues capabilities |

### Dimension 8: Capability Lifecycle

| Phase | Applies to |
|-------|-----------|
| No capability | Off-chain verifier, or verification-only contract |
| Issue capability | Contract verifier mints access artifact |
| Claim capability | Holder redeems capability |
| Deny re-claim | Second claim rejected (consumed) |

### Dimension 9: Protocol Envelope

| Level | What it covers |
|-------|---------------|
| Direct circuit | Pure circuit assertions without protocol message wrapping |
| Protocol messages | Full issuance (offer → request → result) and presentation (request → submission → result) with threaded envelopes |

## Shared ISO Registry

### Package: `credentials-iso-registry`

Compact types for ISO-standard codes, stored as numeric `Uint<16>` values.

```compact
// ISO 3166-1 numeric country codes
export struct CountryCode {
  value: Uint<16>     // e.g., 276 = DE, 840 = US, 380 = IT, 826 = GB
}

// ISO 4217 numeric currency codes
export struct CurrencyCode {
  value: Uint<16>     // e.g., 978 = EUR, 840 = USD, 826 = GBP
}

// ISO 639 language codes (custom numeric mapping)
export struct LanguageCode {
  value: Uint<16>     // e.g., 1 = en, 2 = de, 3 = fr, 4 = es
}

// ISO 3166-2 region (country + subdivision)
export struct RegionCode {
  country: Uint<16>   // ISO 3166-1 numeric
  subdivision: Uint<16> // subdivision index within country
}

// ISO 5218 gender codes
export struct GenderCode {
  value: Uint<8>      // 0 = not known, 1 = male, 2 = female, 9 = not applicable
}
```

Design principles:
- Numeric values are preferred — they are circuit-friendly and comparison-safe
- UI renders numeric codes to human-readable text at the presentation layer
- Compact circuits can assert equality, inequality, and range checks on numeric codes
- All credential families import from this shared registry

## Credential Family Claim Structures

### Birth Credential (existing)

```compact
export struct BirthCredentialClaims {
  subjectIdCommitment: Bytes<32>
  legalNameCommitment: Bytes<32>
  birthDateCommitment: Bytes<32>           // Uint<32> days since epoch
  birthCountryCodeCommitment: Bytes<32>    // CountryCode
}
```

### Passport Credential

```compact
export struct PassportClaims {
  documentNumberCommitment: Bytes<32>
  issuingCountry: CountryCode              // public — credential metadata
  nationalityCommitment: Bytes<32>         // CountryCode — committed
  givenNameCommitment: Bytes<32>
  familyNameCommitment: Bytes<32>
  birthDateCommitment: Bytes<32>           // Uint<32> days since epoch
  genderCommitment: Bytes<32>              // GenderCode — committed
  expiryDate: Uint<32>                     // public — passport validity
}
```

### Driving License Credential

```compact
export struct DrivingLicenseClaims {
  licenseNumberCommitment: Bytes<32>
  issuingCountry: CountryCode              // public
  issuingRegion: RegionCode                // public
  holderNameCommitment: Bytes<32>
  birthDateCommitment: Bytes<32>           // Uint<32> days since epoch
  licenseCategoryCommitment: Bytes<32>     // Uint<8> encoded — committed for predicate
  validFrom: Uint<32>                      // public
  validUntil: Uint<32>                     // public
}
```

### National ID Credential

```compact
export struct NationalIdClaims {
  documentNumberCommitment: Bytes<32>
  issuingCountry: CountryCode              // public — always single country
  givenNameCommitment: Bytes<32>
  familyNameCommitment: Bytes<32>
  birthDateCommitment: Bytes<32>           // Uint<32> days since epoch
  birthPlaceCommitment: Bytes<32>
  residenceRegionCommitment: Bytes<32>     // RegionCode — committed for privacy
  taxIdentifierCommitment: Bytes<32>
}
```

### AML/KYC Compliance Credential

```compact
export struct ComplianceClaims {
  subjectIdCommitment: Bytes<32>
  amlStatus: Uint<8>                       // 0=unchecked, 1=passed, 2=failed — public
  sanctionsScreening: Uint<8>              // 0=unscreened, 1=clear, 2=flagged — public
  pepStatus: Uint<8>                       // 0=not PEP, 1=PEP — public
  riskScoreCommitment: Bytes<32>           // Uint<8> 0-255 — committed for predicate
  jurisdiction: CountryCode                // public
  checkedAt: Uint<32>                      // day count — public
  validUntilDay: Uint<32>                  // expiry — public
}
```

### Employee Credential

```compact
export struct EmployeeClaims {
  employeeIdCommitment: Bytes<32>
  organizationNameCommitment: Bytes<32>
  organizationIdCommitment: Bytes<32>      // LEI or org identifier
  departmentCommitment: Bytes<32>
  roleCommitment: Bytes<32>
  clearanceLevelCommitment: Bytes<32>      // Uint<8> 0-5 — committed for predicate
  employedSince: Uint<32>                  // public — start of employment
}
```

## Use Cases

### UC-1: Age-Gated Venue Access

**Scenario:** A nightclub contract in Germany admits only patrons aged 18+.

| Aspect | Value |
|--------|-------|
| Credentials | Passport OR National ID (either accepted) |
| Holder binding | Blinded secret |
| Disclosures | None — predicate only |
| Predicates | age >= 18 |
| Pseudonym | Verifier-scoped (unique visitor counting) |
| Same-holder | Single credential |
| Verifier | On-chain contract (issues entry capability) |
| Capability | Issue + claim + deny re-claim |

**What this exercises:**
- Two different credential families satisfying the same verifier requirement
- Secret holder with zero disclosure
- Contract-issued capability consumption

### UC-2: Cross-Border Financial Onboarding

**Scenario:** A DeFi lending contract accepts users with valid passport + passing AML/KYC.

| Aspect | Value |
|--------|-------|
| Credentials | Passport + AML/KYC Compliance (both required) |
| Holder binding | Blinded secret |
| Disclosures | Passport nationality, AML status, sanctions screening |
| Predicates | AML not expired, risk score <= 50 |
| Pseudonym | Verifier-scoped (DeFi domain) |
| Same-holder | Two-credential (passport issuer + compliance provider) |
| Verifier | On-chain contract (DeFi participation capability) |
| Capability | Issue + claim |

**What this exercises:**
- Same-holder composition across two families
- Multi-issuer trust
- Mixed disclosure + predicate
- Freshness and threshold predicates

### UC-3: Corporate System Access

**Scenario:** An enterprise API grants access to employees with clearance >= 3 in Engineering.

| Aspect | Value |
|--------|-------|
| Credentials | Employee Credential |
| Holder binding | Explicit DID (enterprise context) |
| Disclosures | Organization ID, department, role |
| Predicates | clearance level >= 3 |
| Pseudonym | None |
| Same-holder | Single credential |
| Verifier | Off-chain agent (API gateway) |
| Capability | None |

**What this exercises:**
- Explicit holder with selective disclosure + predicate
- Off-chain verifier
- Enterprise identity use case

### UC-4: Rental Car Booking

**Scenario:** A car rental contract accepts driving license category B, holder aged 21+.

| Aspect | Value |
|--------|-------|
| Credentials | Driving License |
| Holder binding | Blinded secret |
| Disclosures | License category, issuing country |
| Predicates | age >= 21, license not expired |
| Pseudonym | Verifier-scoped (rental domain) |
| Same-holder | Single credential |
| Verifier | On-chain contract (rental authorization) |
| Capability | Issue + claim |

**What this exercises:**
- Driving license family
- Multiple predicates (age + expiry)
- Disclosure + predicate combination

### UC-5: Government Benefit Eligibility

**Scenario:** A government contract verifies applicant residency via national ID.

| Aspect | Value |
|--------|-------|
| Credentials | National ID |
| Holder binding | Explicit DID (government context) |
| Disclosures | Issuing country, residence region |
| Predicates | None (structural region match) |
| Pseudonym | None |
| Same-holder | Single credential |
| Verifier | On-chain contract (eligibility record) |
| Capability | None (state mutation only) |

**What this exercises:**
- National ID family
- Region-based structural assertion
- Disclosure-only (no predicates)
- Explicit holder with contract verifier

### UC-6: Anonymous Whistleblower Verification

**Scenario:** A journalism platform verifies submitter works at a specific organization.

| Aspect | Value |
|--------|-------|
| Credentials | Employee Credential |
| Holder binding | Blinded secret |
| Disclosures | Organization ID only (minimal) |
| Predicates | None |
| Pseudonym | None (maximum unlinkability) |
| Same-holder | Single credential |
| Verifier | On-chain contract (submission capability) |
| Capability | Issue + claim |

**What this exercises:**
- Minimal disclosure with secret holder
- No predicate, no pseudonym — maximum privacy
- Employee credential in privacy-maximal context

### UC-7: Multi-Credential Travel Check-In

**Scenario:** An airline requires passport + AML + driving license, all from the same holder.

| Aspect | Value |
|--------|-------|
| Credentials | Passport + AML/KYC + Driving License (three required) |
| Holder binding | Blinded secret |
| Disclosures | Passport nationality, AML status, license category |
| Predicates | Passport not expired, AML not expired, license not expired, age >= 18 |
| Pseudonym | Verifier-scoped (airline domain) |
| Same-holder | Three-credential composition |
| Verifier | On-chain contract (staged: check-in + rental) |
| Capability | Issue + claim (two-stage) |

**What this exercises:**
- Three-credential same-holder composition
- Three different issuers
- Staged contract verification
- Maximum predicate and disclosure complexity

### UC-8: Compliance Relay

**Scenario:** A verifier accepts AML from another jurisdiction if check is fresh and risk is low.

| Aspect | Value |
|--------|-------|
| Credentials | AML/KYC Compliance |
| Holder binding | Blinded secret |
| Disclosures | Jurisdiction, AML status, sanctions, PEP status |
| Predicates | Freshness <= 90 days, risk score <= 30 |
| Pseudonym | Verifier-scoped (relay domain) |
| Same-holder | Single credential |
| Verifier | Off-chain agent (compliance relay) |
| Capability | None |

**What this exercises:**
- Compliance credential with freshness predicate
- Risk score threshold
- Cross-jurisdiction acceptance
- Off-chain verifier with pseudonym

## Test Matrix

### Layer 1: Generic Core Tests (credentials/)

These tests validate the generic layer in isolation — no credential family, no business logic.

| Test ID | Component | What it validates |
|---------|-----------|-------------------|
| L1-PROOF-01 | Proof context | Issuance proof verifies against body root |
| L1-PROOF-02 | Proof context | Presentation proof verifies against body root |
| L1-PROOF-03 | Proof context | Tampered body root is rejected |
| L1-PROOF-04 | Proof context | Tampered challenge binding is rejected |
| L1-PROTO-01 | Protocol envelope | Valid initial message accepted |
| L1-PROTO-02 | Protocol envelope | Initial message claiming response is rejected |
| L1-PROTO-03 | Protocol envelope | Valid response envelope accepted |
| L1-PROTO-04 | Protocol envelope | Response to wrong thread rejected |
| L1-BIND-01 | Explicit holder | Valid binding accepted |
| L1-BIND-02 | Explicit holder | Zero contract address rejected |
| L1-BIND-03 | Explicit holder | Matching bindings accepted |
| L1-BIND-04 | Explicit holder | Proof signer matches binding |
| L1-BIND-05 | Secret holder | Commitment derivation |
| L1-BIND-06 | Secret holder | Challenge response derivation (with domain tag) |
| L1-BIND-07 | Secret holder | Verifier-scoped pseudonym derivation |
| L1-BIND-08 | Secret holder | Pseudonym validation |
| L1-BIND-09 | Blinded secret | Blinded commitment derivation |
| L1-BIND-10 | Blinded secret | Blinded witness validation |
| L1-BIND-11 | Same-holder | Two secret bindings, same holder accepted |
| L1-BIND-12 | Same-holder | Two secret bindings, different holder rejected |
| L1-BIND-13 | Same-holder | Two blinded bindings, same holder accepted |
| L1-BIND-14 | Same-holder | Two blinded bindings, different holder rejected |
| L1-BIND-15 | Same-holder | Same binding twice rejected (distinct guard) |

### Layer 2: Credential Family Tests

Each credential family gets the same test template, parameterized by its specific claims and disclosures.

#### Template per family (explicit holder variant)

| Test ID | Component | What it validates |
|---------|-----------|-------------------|
| L2-{FAM}-ISSUE-01 | Issuance | Credential body root is deterministic from claims |
| L2-{FAM}-ISSUE-02 | Issuance | Issuer proof binds to credential body |
| L2-{FAM}-ISSUE-03 | Issuance | Tampered credential rejected |
| L2-{FAM}-PRES-01 | Presentation | Holder proof binds to presentation body |
| L2-{FAM}-PRES-02 | Presentation | Presentation anchored to credential claim root |
| L2-{FAM}-PRES-03 | Presentation | Tampered presentation rejected |
| L2-{FAM}-DISC-01 | Disclosure | Zero disclosure (predicate-only) |
| L2-{FAM}-DISC-02 | Disclosure | Minimal disclosure (1 field) |
| L2-{FAM}-DISC-03 | Disclosure | Selective disclosure (2+ fields) |
| L2-{FAM}-DISC-04 | Disclosure | Request requires disclosure, presentation omits → rejected |
| L2-{FAM}-PRED-01 | Predicate | Family-specific predicate passes |
| L2-{FAM}-PRED-02 | Predicate | Predicate fails (value below threshold) |
| L2-{FAM}-PRED-03 | Predicate | Multiple predicates in one presentation |
| L2-{FAM}-PROTO-01 | Protocol | Issuance offer → request → result alignment |
| L2-{FAM}-PROTO-02 | Protocol | Verification request → submission → result alignment |
| L2-{FAM}-PROTO-03 | Protocol | Mismatched thread rejected |

#### Template per family (secret holder variant)

| Test ID | Component | What it validates |
|---------|-----------|-------------------|
| L2-{FAM}S-ISSUE-01 | Issuance | Blinded holder binding in credential |
| L2-{FAM}S-ISSUE-02 | Issuance | Issuer proof with blinded binding |
| L2-{FAM}S-PRES-01 | Presentation | Challenge response from hidden secret |
| L2-{FAM}S-PRES-02 | Presentation | Wrong secret rejected |
| L2-{FAM}S-PRES-03 | Presentation | Wrong challenge rejected |
| L2-{FAM}S-PSEUDO-01 | Pseudonym | Verifier-scoped pseudonym derived and validated |
| L2-{FAM}S-PSEUDO-02 | Pseudonym | Wrong domain rejected |
| L2-{FAM}S-SAME-01 | Same-holder | Two credentials, same holder accepted |
| L2-{FAM}S-SAME-02 | Same-holder | Two credentials, different holders rejected |
| L2-{FAM}S-DISC-* | Disclosure | Same disclosure tests as explicit variant |
| L2-{FAM}S-PRED-* | Predicate | Same predicate tests as explicit variant |
| L2-{FAM}S-PROTO-* | Protocol | Same protocol tests with secret-holder envelope |

#### Family-Specific Predicates

| Family | Predicate Tests |
|--------|----------------|
| Birth | age >= threshold |
| Passport | age >= threshold, not expired |
| Driving License | age >= threshold, not expired, category match |
| National ID | age >= threshold, region match |
| AML/KYC | not expired, freshness <= N days, risk score <= threshold |
| Employee | clearance >= level, tenure >= N years |

### Layer 3: Business Logic Tests (per use case)

| Test ID | Use Case | Credential(s) | Holder Profile | Verifier | Key Assertion |
|---------|----------|----------------|----------------|----------|---------------|
| L3-UC1a | Age-gated venue | Passport | Blinded secret | Contract | Age predicate + capability lifecycle |
| L3-UC1b | Age-gated venue | National ID | Blinded secret | Contract | Same verifier, different credential family |
| L3-UC2 | DeFi onboarding | Passport + AML/KYC | Blinded secret | Contract | Same-holder 2-credential + mixed predicates |
| L3-UC3 | Corporate access | Employee | Explicit DID | Off-chain | Clearance predicate + selective disclosure |
| L3-UC4 | Car rental | Driving License | Blinded secret | Contract | Multi-predicate (age + expiry + category) |
| L3-UC5 | Govt benefits | National ID | Explicit DID | Contract | Region match + disclosure-only |
| L3-UC6 | Whistleblower | Employee | Blinded secret | Contract | Minimal disclosure + max privacy |
| L3-UC7 | Travel check-in | Passport + AML + License | Blinded secret | Contract | 3-credential same-holder + staged verification |
| L3-UC8 | Compliance relay | AML/KYC | Blinded secret | Off-chain | Freshness + risk score predicates |

### Layer 4: Protocol Agent Tests

| Test ID | Profile | Flow | Parties | Key Assertion |
|---------|---------|------|---------|---------------|
| L4-EXP-ISS | Explicit | Issuance | Issuer ↔ Holder | Protocol messages, party boundaries |
| L4-EXP-PRES | Explicit | Presentation | Holder ↔ Verifier | Challenge binding, disclosure |
| L4-EXP-LIFE | Explicit | Full lifecycle | Issuer → Holder → Contract | End-to-end with capability |
| L4-SEC-ISS | Secret | Issuance | Issuer ↔ Holder | Blinded commitment in request |
| L4-SEC-PRES | Secret | Presentation | Holder ↔ Verifier | Hidden witness, no secret in bus |
| L4-SEC-PSEUDO | Secret | Pseudonym | Holder ↔ Verifier | Pairwise pseudonym |
| L4-SEC-SAME | Secret | Same-holder | Holder ↔ Verifier | Cross-credential composition |
| L4-CONTRACT-AGE | Either | Age-gate | Holder ↔ Contract | Contract-native verification |
| L4-CONTRACT-CAP | Either | Capability | Holder ↔ Contract | Issue + claim + deny |

### Integration Tests (Docker, real DIDs)

| Test ID | Profile | Credentials | What it proves |
|---------|---------|------------|----------------|
| INT-EXP-01 | Explicit | Birth | Full stack with real DID resolution |
| INT-SEC-01 | Secret | Birth (secret) | Secret binding with real issuer DID |
| INT-CONTRACT-01 | Explicit | Birth + Demo contract | Real ZK proofs + contract execution |
| INT-UC2 | Secret | Passport + AML/KYC | Same-holder with real DIDs |
| INT-UC7 | Secret | Passport + AML + License | 3-credential same-holder with real DIDs |

## Test Pyramid

```
                    ┌─────────────────────┐
                    │   Integration (5)   │  Docker, real DIDs, real proofs
                    │   INT-*             │  Slow (~10 min each)
                    ├─────────────────────┤
                    │  Protocol Agent (9) │  Party boundaries, message bus
                    │  L4-*              │  Fast (~1s each)
                ┌───┼─────────────────────┤
                │   │  Business Logic (9) │  Use cases, contracts, capabilities
                │   │  L3-*              │  Medium (~500ms each)
            ┌───┤   ├─────────────────────┤
            │   │   │ Credential Family   │  Per-family × per-profile
            │   │   │ L2-* (~16/family    │  Fast (~50ms each)
            │   │   │      × 6 families   │  ~96 tests for explicit
            │   │   │      × 2 profiles)  │  ~72 tests for secret
        ┌───┤   │   ├─────────────────────┤
        │   │   │   │  Generic Core (15)  │  Proof, protocol, bindings
        │   │   │   │  L1-*              │  Fast (~5ms each)
        └───┴───┴───┴─────────────────────┘
```

**Estimated total:** ~200+ tests across the full matrix

## Coverage by Dimension

### Holder Binding × Credential Family

| | Explicit DID | Blinded Secret |
|---|---|---|
| Birth | L2-BIRTH-* (existing) | L2-BIRTHS-* (existing) |
| Passport | L2-PASS-* | L2-PASSS-* |
| Driving License | L2-DL-* | L2-DLS-* |
| National ID | L2-NID-* | L2-NIDS-* |
| AML/KYC | L2-COMP-* | L2-COMPS-* |
| Employee | L2-EMP-* | L2-EMPS-* |

**12 family × profile combinations**, each with ~16 tests = **~192 Layer 2 tests**

### Disclosure Level × Credential Family

| | 0 (predicate-only) | 1 (minimal) | 2-3 (selective) |
|---|---|---|---|
| Birth | UC-1 | — | UC-2 |
| Passport | UC-1 | — | UC-2, UC-7 |
| Driving License | — | — | UC-4, UC-7 |
| National ID | — | — | UC-5 |
| AML/KYC | — | — | UC-2, UC-7, UC-8 |
| Employee | — | UC-6 | UC-3 |

### Predicate Type Coverage

| Predicate | Families that use it | Use Cases |
|-----------|---------------------|-----------|
| age >= N | Birth, Passport, DL, NID | UC-1, UC-2, UC-4, UC-7 |
| not expired | Passport, DL, AML | UC-4, UC-7, UC-8 |
| risk score <= N | AML | UC-2, UC-8 |
| freshness <= N days | AML | UC-8 |
| category match | DL | UC-4 |
| clearance >= N | Employee | UC-3 |
| region match | NID | UC-5 |

### Same-Holder Composition Coverage

| Composition | Use Case | Credential Families |
|-------------|----------|---------------------|
| Single | UC-1, UC-3, UC-4, UC-5, UC-6, UC-8 | Various |
| Two-credential | UC-2 | Passport + AML/KYC |
| Three-credential | UC-7 | Passport + AML/KYC + Driving License |

### Verifier Mode Coverage

| Mode | Use Cases |
|------|-----------|
| Off-chain agent | UC-3, UC-8 |
| On-chain contract | UC-1, UC-2, UC-4, UC-5, UC-6, UC-7 |

## Implementation Priority

### Phase 1: Foundation (current — done)

- [x] Generic core (Layer 1) — 9 tests
- [x] Birth credential family, both profiles (Layer 2) — 24 tests
- [x] Demo contract (Layer 3) — 7 tests
- [x] Protocol agents (Layer 4) — 21 tests
- [x] Integration tests — 3 tests

### Phase 2: ISO Registry + Credential Families

- [ ] `credentials-iso-registry` package with country, region, currency, language, gender codes
- [ ] Passport credential family (explicit + secret variants)
- [ ] Driving License credential family (explicit + secret variants)
- [ ] National ID credential family (explicit + secret variants)
- [ ] AML/KYC Compliance credential family (explicit + secret variants)
- [ ] Employee credential family (explicit + secret variants)

### Phase 3: Use Case Contracts

- [ ] UC-1: Age-gated venue contract (passport OR national ID)
- [ ] UC-2: DeFi onboarding contract (passport + AML same-holder)
- [ ] UC-3: Corporate access verifier (employee, off-chain)
- [ ] UC-4: Car rental contract (driving license)
- [ ] UC-5: Government benefit contract (national ID)
- [ ] UC-6: Whistleblower contract (employee, max privacy)
- [ ] UC-7: Travel check-in contract (3-credential staged)
- [ ] UC-8: Compliance relay verifier (AML, off-chain)

### Phase 4: Full Matrix Integration

- [ ] Protocol agent tests for all new families
- [ ] Integration tests for UC-2 and UC-7 (multi-credential with real DIDs)
- [ ] Three-credential same-holder circuit (extends current two-credential pattern)

## Appendix: Negative Test Cases

Every positive test has a negative counterpart. Key negative cases:

| Category | Negative Test |
|----------|--------------|
| Wrong issuer | Credential signed by unauthorized issuer → rejected |
| Wrong holder | Presentation from different holder → rejected |
| Expired credential | Verifier checks expiry → rejected |
| Below age threshold | Age predicate fails → rejected |
| Missing disclosure | Request requires field, presentation hides it → rejected |
| Wrong pseudonym domain | Pseudonym from different domain → rejected |
| Different holder secret | Same-holder proof with two different secrets → rejected |
| Replayed presentation | Same challenge reused → rejected (if verifier tracks) |
| Tampered claim root | Modified claim after issuance → rejected |
| Wrong credential family | Passport presented where license required → rejected |
| Expired AML check | Freshness predicate fails → rejected |
| Risk score too high | Threshold predicate fails → rejected |
| Wrong license category | Category match fails → rejected |
| Insufficient clearance | Clearance predicate fails → rejected |
| Wrong region | Region match fails → rejected |
