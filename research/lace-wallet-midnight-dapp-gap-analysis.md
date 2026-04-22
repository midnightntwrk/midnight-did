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

The reusable root-level credential prototype contains:

- `credentials`
- `credentials-same-holder`
- `credentials-iso-registry`
- `credentials-birth`
- `credentials-birth-secret`
- `credentials-demo-contract`
- `credentials-protocol`
- `credentials-openid`
- `standalone-environment`

The Midnight Passport-specific prototype packages live under
`midnight-passport-prototype/packages`:

- `credentials-passport`
- `credentials-passport-secret`
- `credentials-compliance`

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

`credentials-compliance` now provides the first executable compliance /
sanctions credential family for prototype flows. It models PASS/FAIL screening,
PEP status, checked-list metadata, screening freshness, expiry, blinded secret
holder binding, and verifier-scoped pseudonyms.

## Use Case Matrix

| Use case | Current status | Prototype path | Main gaps |
|---|---|---|---|
| UC-1 Wallet Initialization | Partially covered by DID Manager, secret storage, and standalone DID provisioning tests | Simulate wallet identity with a Midnight DID profile, generated wallet seed, seed-derived holder material, and separate off-chain proof material | No Lace wallet app, no mobile secure element integration, no single high-level wallet initialization API that creates DID + Ed25519 + JubJub + relationships together |
| UC-2 Passkey Registration | Prototype-covered without real WebAuthn | Simulate passkey PRF output, HKDF-derived KEKs, AES-GCM protected secret/VC stores, explicit lock/unlock actions, and random wallet seed persistence inside the encrypted secret store | No browser WebAuthn PRF calls, no iOS Keychain / Android Keystore wrapper, no encrypted VC store package |
| UC-3a National ID Issuance | Covered by secret passport credential fixtures, standalone DID integration, `credentials-openid` envelope schemas, and the Passport prototype redirect flow | Use `credentials-passport-secret` as the National ID proxy; the issuer has a prototype Midnight DID and JubJub signing method; redirect to the issuer page, complete mocked checks, return a credential offer URI, and redeem it through token + credential request/response messages | No production OIDC/OAuth hardening, no real document/liveness integration, no issuer persistence |
| UC-3b Sanction Screening Issuance | Partially covered by `credentials-compliance` fixtures, protocol tests, and `credentials-openid` envelope schemas | Use secret passport selective disclosure and verifier-scoped pseudonym as screening input; issue a `SanctionScreeningCredential` in the prototype; wrap issuance in OID4VCI-style messages | No screener service actor, no OID4VCI transport, no sanctions/PEP data adapters |
| UC-4a External Wallet Connect | Out of scope for current repo | Document only | Requires DApp frontend, EIP-1193 provider handling, WalletConnect v2, external asset balance reads |
| UC-4b Investment Product Selection | Partially covered by Passport prototype browser shell | Use the fixed `Private Growth Note` product exposed by the TypeScript session backend | No product registry, no multiple product catalogue, no network-backed contract state |
| UC-4c Proof-Gated Fund Transfer | Partially covered by `credentials-demo-contract`, same-holder circuits, and `credentials-compliance` | Compose passport age/expiry predicates with sanctions PASS/PEP/freshness predicates and same-holder proof | No investment contract, no fund custody/transfer logic, no typed non-reverting denial model for all failure reasons |

## Executable Prototype Coverage

The current review adds `midnight-passport-prototype/src/test/lace-wallet-use-cases.test.ts`.

That test suite and the Passport prototype session backend model:

1. UC-1: separate wallet identity material
   - Midnight DID/JubJub profile
   - Ed25519 off-chain signing key
   - explicit separation between DID credential proof keys and OID4VCI-style
     proof-of-possession keys

2. UC-2: passkey-protected local stores
   - prototype passkey credential and PRF-like secret input
   - HKDF-derived `KEK` and `KEK_vc`
   - AES-256-GCM encryption/decryption
   - separate secret store and VC store keys
   - explicit wallet lock/unlock state
   - generated Midnight wallet seed stored inside the encrypted secret store

3. UC-3a: anonymous National ID issuance proxy
   - `SecretPassportCredential` as a National ID stand-in
   - `BlindedSecretHolderBinding`
   - issuer proof validation with a prototype Midnight DID / JubJub method
   - no explicit holder DID in the credential body

4. UC-3b: screening input proof
   - selective disclosure from the passport credential
   - verifier-scoped pseudonym stability for one domain
   - verifier-scoped pseudonym unlinkability across domains

5. UC-4c: investment proof composition proxy
   - passport age predicate
   - passport expiry predicate
   - `SanctionScreeningCredential` PASS predicate
   - PEP=false predicate
   - same-holder proof between passport binding and screening binding

6. Browser-backed prototype orchestration
   - `GET /api/state` exposes current wallet, issuer, disclosure, protocol, and
     investment state to the browser shell
   - `POST /api/actions/*` drives the same wallet, issuer, verifier, and
     external-wallet actors used by the TypeScript tests
   - the browser no longer mutates a fake in-page state machine for the main
     happy and denied paths
   - National ID issuance now redirects to a dedicated issuer page; document
     upload, liveness, and profile approval are mocked, while the offer/token/
     credential message exchange is OID4VCI-shaped

## Required New Work

### 1. `credentials-compliance`

Implemented first prototype package:

- `SanctionScreeningCredential`
- `SanctionScreeningCredentialPresentation`
- `SanctionScreeningCredentialPresentationRequest`
- PASS/FAIL disclosure
- PEP flag disclosure
- screening freshness predicate
- issuer jurisdiction / checked-list metadata
- secret-holder binding support

Remaining work:

- create a real compliance issuer actor in `credentials-protocol`
- wire the issuer actor to fake sanctions/PEP data adapters
- expose OID4VCI/OID4VP-like offer/request/result messages over a transport later

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
