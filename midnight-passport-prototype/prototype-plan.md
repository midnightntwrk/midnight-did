# Midnight Passport Prototype Plan

Date: 2026-04-21

Status: draft implementation plan

## Goal

Prototype the Lace Wallet + Midnight Passport DApp flow end-to-end using the
current Midnight DID and Midnight Credentials packages, while adding the missing
components required by the BRD/FRD:

- compliance / sanctions credential family
- investment verifier contract
- OID4VCI-like domain protocol
- encrypted wallet credential store
- issuer emulators
- crypto wallet stub
- standalone UI that ties the actors together

The prototype should prove the flow, not ship a product UI.

## Guiding Principles

1. Compact-first for credential and verification semantics.
2. TypeScript orchestration for protocol and application wiring.
3. Keep issuer, wallet, DApp, and contract boundaries explicit, even if they run
   in one SPA.
4. Prototype with deterministic fixtures first; add random production-grade
   nonces and persistence after the flows are green.
5. Avoid implementing browser extension or mobile-specific mechanics until the
   domain model is proven.

## SPA vs Chrome Extension

### Option A: Standalone SPA

Recommended for the first prototype.

| Aspect | Assessment |
|---|---|
| Complexity | Medium |
| Estimated effort | 5-8 focused engineering days after missing credential packages are in place |
| Testability | High with Playwright |
| Security fidelity | Medium; can emulate WebAuthn PRF and wallet isolation, but not actual extension isolation |
| Best use | Validate flows, actors, UI language, and circuit/protocol composition |

### Option B: Chrome Extension + DApp page

Good second iteration, not first.

| Aspect | Assessment |
|---|---|
| Complexity | High |
| Estimated effort | 8-15 focused engineering days after SPA is stable |
| Testability | Medium; Playwright extension testing is possible but slower |
| Security fidelity | Higher; can model wallet-to-DApp permission prompts and extension storage |
| Best use | Validate extension messaging, permission prompts, and wallet/DApp separation |

### Recommendation

Build the standalone SPA first with a `WalletBridge` abstraction:

- In standalone mode, the DApp calls the in-process wallet service.
- In extension mode, the same interface can later be implemented with
  `window.postMessage`, content scripts, and extension background service worker
  messaging.

## Target Directory Shape

```text
midnight-passport-prototype/
  README.md
  prototype-plan.md
  app/                         # future Vite SPA
    src/
      actors/
        wallet/
        national-id-issuer/
        sanctions-issuer/
        passport-dapp/
        crypto-wallet-stub/
      services/
        wallet-bridge.ts
        oid4vci-protocol.ts
        encrypted-store.ts
      views/
        WalletPanel.tsx
        IssuerPanel.tsx
        InvestmentPanel.tsx
        EventLog.tsx
  tests/
    e2e/
      passport-flow.spec.ts
```

The package boundary is intentional:

- reusable credential capabilities stay at repository top level
- Passport-product credential families stay under
  `midnight-passport-prototype/packages`
- future reusable contract packages should only move to the root once their
  API is no longer Passport-specific

Current Passport-specific packages:

- `midnight-passport-prototype/packages/credentials-passport`
- `midnight-passport-prototype/packages/credentials-passport-secret`
- `midnight-passport-prototype/packages/credentials-compliance`

## Missing Component Plan

### Phase 0: Safety Baseline

Purpose: keep the branch stable while adding prototype breadth.

Tasks:

- Keep `./run.sh` green.
- Keep `./run-credentials.sh` green.
- Keep the current gap-analysis document updated as the source of truth.
- Add all generated app artifacts to `.gitignore` before introducing SPA tools.

Acceptance criteria:

- Current branch remains green before Phase 1.
- No generated files are tracked accidentally.

## Phase 1: Compliance Credential Family

Status: implemented as the first reusable prototype package.

Package: `midnight-passport-prototype/packages/credentials-compliance`

Purpose: replace the synthetic sanctions PASS object used in the current
prototype test with a real Compact credential family.

Credential:

```text
SanctionScreeningCredential
  envelope:
    version
    schema
    issuerVerificationMethodRef
    holderBinding: BlindedSecretHolderBinding
    issuedAt
    hasExpiration
    expiresAt
  claims:
    subjectIdCommitment: Bytes<32>
    screeningResult: Uint<8>      # 0 unset, 1 PASS, 2 FAIL
    isPep: Boolean
    sanctionsListsChecked: Uint<8> # OFAC=1, EU=2, UN=4
    jurisdiction: Uint<16>         # ISO country code
    riskLevel: Uint<8>
    screeningDateCommitment: Bytes<32>
    validUntilDay: Uint<32>
  claimRoot: Bytes<32>
```

Presentation capabilities:

- disclose `screeningResult`
- disclose `isPep`
- prove screening freshness from committed screening date
- prove not expired
- verifier-scoped pseudonym, optional
- blinded secret holder binding

Implemented tests:

- valid credential proof
- PASS disclosure accepted
- FAIL disclosure rejected by helper
- PEP true rejected by helper when `requirePepFalse`
- screening freshness predicate accepted/rejected
- same-holder composition with secret passport credential through the Lace
  Wallet use-case test

Acceptance criteria:

- `npm run all -w @midnight-ntwrk/midnight-did-credentials-compliance`
- new tests prove real sanctions PASS credential instead of synthetic object

## Phase 2: Compliance Issuer Emulator

Status: first in-memory actor implemented in `midnight-passport-prototype`.

Package or module: `credentials-protocol`

Purpose: model the Sanction Screening Issuer as a real protocol actor.

Actors:

- `ComplianceIssuerAgent`
- `ComplianceHolderAgent` extension or wallet-side helper

Flow:

1. issuer sends presentation request for passport/National ID data
2. wallet builds selective disclosure presentation
3. issuer verifies disclosure and pseudonym
4. issuer evaluates fake sanctions data adapter
5. issuer issues `SanctionScreeningCredential` on PASS
6. wallet stores it

Test cases:

- PASS screening issues a credential
- sanctioned jurisdiction fails before issuance
- PEP match fails before issuance
- issuer receives pseudonym but not holder DID

Acceptance criteria:

- protocol unit tests pass with two issuer agents:
  - passport/National ID issuer
  - sanctions issuer

Current implementation note:

- `NationalIdIssuerAgent` and `ComplianceIssuerAgent` live in the prototype
  package for now.
- The compliance issuer verifies the National ID proxy presentation before
  issuing the compliance credential.
- The wallet stores issued credential bodies/proofs and derives fresh
  verifier-scoped presentations for each investment verification request.
- Transport and real sanctions/PEP data adapters are still future work.

## Phase 3: OpenID Domain Protocol Prototype

Status: first reusable Zod schema package implemented as `credentials-openid`.

Package: `credentials-openid`

Purpose: model OID4VCI/OID4VP-inspired message shapes without committing to HTTP, OAuth server behavior, JWT proof generation, or DIDComm transport yet.

Domain objects:

- OID4VCI-style `CredentialIssuerMetadata`
- OID4VCI-style `CredentialOffer`
- OID4VCI-style `TokenRequest` and `TokenResponse`
- OID4VCI-style `CredentialRequest` and `CredentialResponse`
- OID4VP-style `PresentationDefinition`
- OID4VP-style authorization request and response envelopes
- OID4VP-style `PresentationSubmission` descriptor maps
- Midnight extensions for Compact VC/VP payloads and holder-binding commitments

Important behavior:

- `pre_authorized_code` is single use
- `c_nonce` must match proof
- ephemeral Ed25519 key is single use
- `kid` is raw public-key identifier, not DID URL
- holder DID is not sent to issuer

Implemented tests:

- pre-authorized credential offer to credential request/response
- credential offer URI round trip
- invalid empty credential configuration list rejected
- multi-credential OID4VP request for passport + compliance presentations
- presentation submission descriptor map validation
- Passport prototype test wrapping existing Midnight payloads in OpenID-shaped envelopes

Still pending for a later transport/state-machine phase:

- single-use pre-authorized code tracking
- `c_nonce` replay protection
- ephemeral proof-of-possession key policy
- HTTP/OIDC and DIDComm bindings

Acceptance criteria:

- `npm run all -w credentials-openid`
- `npm run all -w midnight-passport-prototype`

## Phase 4: Investment Contract Prototype

Status: first in-memory verifier contract stub implemented in
`midnight-passport-prototype`.

Package: `credentials-passport-dapp-contract` or `credentials-investment-contract`

Purpose: replace the current `credentials-demo-contract` age-gate with a
business contract that composes two credential families.

Contract capabilities:

- `getInvestmentRequirements()`
- verify passport/National ID age predicate
- verify sanctions credential PASS
- verify PEP false
- verify screening freshness
- verify both credentials share one hidden holder secret
- issue participation capability/nullifier
- reject replay

Notes:

- Compact circuits usually fail on assertion for invalid witnesses. If typed
  denial codes are required, we need a deliberate design that separates
  preflight checks from proof-enforced assertions. The first prototype can use
  assertion failures plus simulator helper mapping; production can revisit
  typed denial semantics.

Tests:

- accepted investment proof
- age below threshold rejected
- sanctions FAIL rejected
- PEP true rejected
- holder-binding mismatch rejected
- expired screening rejected
- capability cannot be claimed twice

Acceptance criteria:

- simulator test proves the complete UC-4c verification path.

## Phase 5: Wallet Store Layer

Prototype module: `midnight-passport-prototype/app/src/services/encrypted-store.ts`

Purpose: model wallet-local encrypted stores.

Stores:

- secret store: DID/JubJub/Ed25519 key refs
- VC store: issued credentials + witness openings

Unlock adapters:

- `StaticPrfAdapter` for deterministic tests
- `PinDerivedAdapter` for local demo
- placeholder `WebAuthnPrfAdapter`

Tests:

- separate KEK for secret and VC stores
- wrong KEK fails decryption
- lock clears session material
- credentials cannot be used while locked

Acceptance criteria:

- wallet panel can lock/unlock and persist a credential session locally.

## Phase 6: Standalone SPA

Directory: `midnight-passport-prototype/app`

Status: API-backed browser shell implemented without a React build step.

Current stack:

- TypeScript Node server in `src/serve-app.ts`
- TypeScript session backend in `src/app-session.ts`
- static browser shell in `app/`
- no browser extension in first iteration

Views:

- Wallet Setup
- National ID Issuer
- Sanction Screening Issuer
- Investment DApp
- External Wallet Stub
- Event Log

End-to-end user flow:

1. create wallet identity
2. register passkey/PIN unlock mode
3. get National ID / passport proxy credential
4. get sanctions credential
5. connect crypto wallet stub
6. select investment product
7. approve proof request
8. submit proof to contract simulator
9. receive capability

Acceptance criteria:

- Browser buttons call `/api/actions/*`, not a mocked in-page state machine.
- The API-backed session runs the whole flow through wallet, issuer, verifier,
  and external wallet actors.
- Event log explains every actor interaction.
- The user can inspect the disclosure summary before presentation.

Current implementation notes:

- `GET /api/state` returns wallet, credential, disclosure, protocol, investment,
  action-enabled, and event-log state.
- `POST /api/actions/initializeWallet` opens the passkey-derived secret and VC
  stores.
- `POST /api/issuer/national-id/start` redirects the browser to a dedicated
  Digital National ID issuer page.
- the issuer page mocks document upload, liveness check, and manual approval
  with buttons; these are intentionally not real document/biometric
  integrations.
- `POST /api/issuer/national-id/sessions/:id/complete` returns the user to the
  wallet with an OID4VCI credential offer URI.
- `POST /api/issuer/national-id/redeem` performs the wallet-side token request
  and credential request/response exchange, then stores the Digital National ID
  credential.
- `POST /api/actions/issueCompliance` issues the compliance screening
  credential.
- `POST /api/actions/prepareProof` asks the wallet bridge to derive fresh
  verifier-scoped presentations.
- `POST /api/actions/approveProof` verifies the proof bundle in the investment
  verifier contract stub.
- `POST /api/actions/settleInvestment` transfers through the external wallet
  stub only after proof approval.
- `POST /api/actions/runDeniedPath` models a sanctions/PEP denial before proof
  creation.

Browser e2e coverage:

- approved flow: wallet initialization, National ID issuance, compliance
  issuance, proof preparation, verifier approval, and external-wallet
  settlement; National ID issuance goes through a real browser redirect to the
  issuer page and back to the wallet
- denied flow: compliance rejection before proof preparation

Remaining work:

- Consider moving to Vite/React only if the static shell starts to slow down
  iteration.

## Phase 7: Optional Chrome Extension Spike

Only start after the standalone SPA proves the domain model.

Components:

- extension background service worker
- wallet popup
- content script
- DApp page bridge

Messaging:

- `passport.requestCredentials`
- `passport.requestPresentation`
- `passport.signPresentation`
- `passport.getStatus`

Acceptance criteria:

- DApp page can request a proof from extension wallet.
- Extension prompts user and returns a VP package.
- The same domain services from the SPA are reused.

## Proposed Milestones

| Milestone | Scope | Estimated complexity |
|---|---|---|
| M1 | `midnight-passport-prototype/packages/credentials-compliance` package + tests | Medium |
| M2 | compliance issuer emulator + OID4VCI domain objects | Medium |
| M3 | investment contract simulator | Medium-high |
| M4 | encrypted wallet store | Medium |
| M5 | standalone SPA with full Playwright flow | High |
| M6 | Chrome extension spike | High, optional |

## Current Recommendation

Start with M1 and M2.

Reasoning:

- They remove the biggest semantic fake in the current prototype: synthetic
  sanctions PASS.
- They create the second real credential required by the investment flow.
- They keep work in Compact and TypeScript tests before UI complexity arrives.

After M1/M2, implement the investment contract. Only then build the SPA.
