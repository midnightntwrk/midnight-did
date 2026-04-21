# Lace Wallet + Midnight Passport DApp Gap Analysis

Date: 2026-04-21

Status: Prototype review

Source document: `research/lace-wallet-midnight-dapp-brd-frd.md`

## Purpose

This document maps the Lace Wallet + Midnight Passport DApp requirements to the
current Midnight DID / Midnight Credentials prototype. It separates:

- what is already implemented and testable
- what can be prototyped with existing packages
- what requires new packages or application infrastructure

The goal is to avoid treating product-level requirements as implemented
cryptographic capabilities until there is a Compact circuit, TypeScript
protocol model, and test coverage for the behavior.

## Current Package Reality

The BRD/FRD uses target product names:

- `credentials-national-id`
- `credentials-compliance`
- `NationalIdCredential`
- `SanctionScreeningCredential`
- `Investment Smart Contract`

The current repository contains:

- `credentials`
- `credentials-same-holder`
- `credentials-iso-registry`
- `credentials-birth`
- `credentials-birth-secret`
- `credentials-passport`
- `credentials-passport-secret`
- `credentials-demo-contract`
- `credentials-protocol`
- `standalone-environment`

For now, `credentials-passport-secret` is the closest executable proxy for the
National ID flow because it contains:

- committed document number
- public issuing country
- committed nationality
- committed given/family names
- committed birth date
- committed gender
- public expiry date
- blinded secret holder binding
- verifier-scoped pseudonym support
- age and expiry predicates

There is no dedicated compliance or sanctions credential package yet.

## Use Case Matrix

| Use case | Current status | Prototype path | Main gaps |
|---|---|---|---|
| UC-1 Wallet Initialization | Partially covered by DID Manager, secret storage, and standalone DID provisioning tests | Simulate wallet identity with a Midnight DID profile, JubJub signer, and separate Ed25519 off-chain key | No Lace wallet app, no mobile secure element integration, no single high-level wallet initialization API that creates DID + Ed25519 + JubJub + relationships together |
| UC-2 Passkey Registration | Not implemented as WebAuthn or mobile OS integration | Simulate PRF/PIN output, HKDF-derived KEKs, and AES-GCM protected secret/VC stores | No browser WebAuthn PRF calls, no iOS Keychain / Android Keystore wrapper, no encrypted VC store package |
| UC-3a National ID Issuance | Partially covered by secret passport credential fixtures and standalone DID integration | Use `credentials-passport-secret` as the National ID proxy and validate the blinded holder binding + issuer proof | No OID4VCI endpoints, no pre-authorized code state machine, no ephemeral Ed25519 proof-of-possession API, no real document/liveness integration |
| UC-3b Sanction Screening Issuance | Not implemented as a credential family | Use secret passport selective disclosure and verifier-scoped pseudonym as screening input; use a synthetic PASS result in tests | No `credentials-compliance` package, no sanctions claim model, no screener issuance protocol, no sanctions/PEP data adapters |
| UC-4a External Wallet Connect | Out of scope for current repo | Document only | Requires DApp frontend, EIP-1193 provider handling, WalletConnect v2, external asset balance reads |
| UC-4b Investment Product Selection | Out of scope for current repo | Document only | Requires DApp UI and product registry/contract state |
| UC-4c Proof-Gated Fund Transfer | Partially covered by `credentials-demo-contract` age-gate and same-holder circuits | Compose passport age/expiry predicates with a synthetic sanctions PASS binding and same-holder proof | No investment contract, no fund custody/transfer logic, no sanctions credential circuit, no typed non-reverting denial model for all failure reasons |

## Executable Prototype Coverage

The current review adds `credentials-protocol/src/test/lace-wallet/use-cases.test.ts`.

That test suite models:

1. UC-1: separate wallet identity material
   - Midnight DID/JubJub profile
   - Ed25519 off-chain signing key
   - explicit separation between DID credential proof keys and OID4VCI-style
     proof-of-possession keys

2. UC-2: passkey-protected local stores
   - PRF/PIN-like secret input
   - HKDF-derived `KEK` and `KEK_vc`
   - AES-256-GCM encryption/decryption
   - separate secret store and VC store keys

3. UC-3a: anonymous National ID issuance proxy
   - `SecretPassportCredential` as a National ID stand-in
   - `BlindedSecretHolderBinding`
   - issuer proof validation
   - no explicit holder DID in the credential body

4. UC-3b: screening input proof
   - selective disclosure from the passport credential
   - verifier-scoped pseudonym stability for one domain
   - verifier-scoped pseudonym unlinkability across domains

5. UC-4c: investment proof composition proxy
   - passport age predicate
   - passport expiry predicate
   - synthetic sanctions PASS record
   - same-holder proof between passport binding and screening binding

## Required New Work

### 1. `credentials-compliance`

Create a dedicated compliance credential family:

- `SanctionScreeningCredential`
- `SanctionScreeningPresentation`
- `SanctionScreeningPresentationRequest`
- PASS/FAIL disclosure
- PEP flag disclosure
- screening freshness predicate
- issuer jurisdiction / checked-list metadata
- secret-holder binding support

### 2. Investment Contract Prototype

Create a dedicated business contract package instead of overloading
`credentials-demo-contract`:

- typed `InvestmentRequirements`
- issuer restrictions for National ID and screening issuers
- age predicate check
- screening PASS check
- same-holder proof check
- nullifier or capability commitment
- typed denial codes where possible

### 3. OID4VCI Domain Protocol Layer

Add an application-layer protocol package or module that models:

- credential offer
- pre-authorized code
- token response
- `c_nonce`
- ephemeral Ed25519 proof-of-possession
- Midnight holder commitment extension
- credential response

This should remain transport-agnostic first. HTTP/OIDC and DIDComm bindings can
come later.

### 4. Wallet Store Layer

Add a local wallet store abstraction:

- encrypted secret store envelope
- encrypted VC store envelope
- key derivation interface
- WebAuthn PRF adapter for web
- PIN/password fallback adapter
- mobile adapter placeholders

### 5. Product/DApp Layer

The following are outside the current protocol and circuit prototype:

- Lace UI
- external wallet connection
- investment product catalogue
- balance reads
- fiat/crypto transfer rails

These should not be implemented inside the credential packages.

## Specification Corrections Needed

The BRD/FRD should be updated before it becomes a normative spec:

- Replace the deleted `research/webauthn-es256-implementation-plan.md`
  reference with this gap-analysis document or a future passkey ADR.
- Mark `credentials-national-id` and `credentials-compliance` as target
  packages, not existing packages.
- Clarify that `credentials-passport-secret` is the current executable proxy
  for National ID.
- Clarify that P-256 passkeys are for wallet unlock/store protection, not
  Midnight VC/VP proof signing.
- Clarify that external wallet connection and investment product selection are
  DApp concerns, not credential package responsibilities.

