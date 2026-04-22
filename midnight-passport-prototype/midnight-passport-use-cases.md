# Midnight Passport Prototype Use Cases

Status: living prototype log. Update this file after every Midnight Passport
prototype iteration with implemented use cases, simplified or mocked behavior,
leftovers, and production-readiness notes.

## Scope

The prototype validates how a Midnight Passport-style wallet, credential
issuers, a DApp verifier, a verifier contract, and an external payment wallet
can collaborate around Midnight Credentials. It runs as one local service for
fast iteration, but each use case keeps explicit boundaries between wallet,
issuer, verifier, DApp, and payment actors.

## Summary Matrix

| ID | Use case | Implemented | Main simplification | Production focus |
|---|---|---|---|---|
| UC-1 | Initialize Passport wallet | Yes | deterministic passkey fixture and in-memory stores | WebAuthn PRF, persistent secure storage, seed recovery policy |
| UC-2 | Lock and unlock wallet session | Yes | no platform biometric or secure-element prompt | user presence, timeout, session persistence |
| UC-3 | Issue Digital National ID | Yes | document/liveness/approval are buttons | real KYC provider and OID4VCI issuer service |
| UC-4 | Present National ID to Screening issuer | Yes | VP includes simulator-only fixture context | production VP proof transport and DID key resolution |
| UC-5 | Issue Screening VC | Yes | sanctions/PEP checks are buttons | screening provider integration and audit policy |
| UC-6 | Deny Screening issuance | Yes | deterministic denial buttons | structured review and appeal flows |
| UC-7 | Prepare investment proof | Yes | verifier contract is an in-process simulator | deployed verifier contract and protocol transport |
| UC-8 | Approve and settle investment | Yes | external crypto wallet is a stub | wallet API and real transaction signing |
| UC-9 | Browser happy path | Yes | all actors share one process | independent services and cross-origin redirects |
| UC-10 | Browser denied paths | Yes | deterministic provider outcomes | expired sessions, replay handling, and recovery UX |

## UC-1: Initialize Passport Wallet

The user initializes a Midnight Passport wallet profile. The wallet creates two
encrypted stores, derives holder secret material, and generates a random
32-byte Midnight wallet seed. The UI displays only a hash of the seed.

Low-level implementation:

| Detail | Location |
|---|---|
| Passkey-style PRF fixture | `src/crypto/passkey.ts` |
| AES-GCM store encryption and key derivation | `src/crypto/secure-store.ts` |
| Wallet initialization and seed hashing | `src/actors/wallet.ts` |
| UI/API orchestration | `src/app-session.ts`, `src/serve-app.ts`, `app/app.js` |
| Browser assertion | `src/e2e/passport-prototype.spec.ts` |
| Session/unit coverage | `src/test/app-session.test.ts`, `src/test/prototype-flow.test.ts` |

Protocol and data shape:

- `MidnightPassportWallet.initialize()` accepts passkey PRF material and an
  optional wallet seed.
- If no seed is provided, the wallet generates 32 random bytes.
- Holder material is derived from seed-labeled hashes for passport and
  compliance credential families.
- The seed is placed only inside the encrypted secret store.
- The UI exposes `walletSeedHash`, never the raw seed.

Mocked or simplified:

- The passkey credential id and PRF output are deterministic fixtures.
- Stores live in process memory.
- There is no platform authenticator prompt.

Production readiness gaps:

- Use WebAuthn PRF or a platform secure element.
- Persist encrypted stores across sessions.
- Add seed backup, recovery, rotation, and device migration policy.
- Integrate with a real Midnight wallet account once the product boundary is
  clear.

## UC-2: Lock And Unlock Wallet Session

The wallet can be locked and reopened. Credential issuance and proof creation
are blocked while locked.

Low-level implementation:

| Detail | Location |
|---|---|
| Lock/unlock state | `src/actors/wallet.ts` |
| Bridge boundary | `src/bridge/wallet-bridge.ts` |
| Action enablement | `src/app-session.ts`, `app/app.js` |
| Browser coverage | `src/e2e/passport-prototype.spec.ts` |
| Session coverage | `src/test/app-session.test.ts` |

Protocol and data shape:

- `lock()` only closes the in-memory session.
- `unlock()` verifies encrypted stores are readable with passkey-derived keys.
- Wallet actions call `assertUnlocked()` before reading credentials or creating
  presentations.

Mocked or simplified:

- No OS keystore, biometric prompt, or user-presence ceremony.
- No idle timeout.

Production readiness gaps:

- Use platform user-presence checks.
- Add lock timeout and secure memory hygiene.
- Persist store metadata and handle corrupted store recovery.

## UC-3: Issue Digital National ID

The wallet starts issuance, redirects the user to a National ID issuer page,
passes mocked identity checks, receives an OID4VCI-shaped credential offer, and
stores a Compact National ID credential signed by the issuer JubJub key.

Low-level implementation:

| Detail | Location |
|---|---|
| Issuer agent and DID/JubJub key fixture | `src/actors/national-id-issuer.ts` |
| OID4VCI issuer service | `src/issuers/national-id-issuer-service.ts` |
| Shared issuer session plumbing | `src/issuers/issuer-session.ts` |
| Issuer browser page | `app/national-id-issuer.html`, `app/national-id-issuer.js` |
| Credential family | `packages/credentials-passport-secret` |
| OpenID domain envelopes | `credentials-openid/` |
| Tests | `src/test/national-id-issuer-service.test.ts`, `src/e2e/passport-prototype.spec.ts` |

Protocol and data shape:

- `POST /api/issuer/national-id/start` creates an issuer session.
- The issuer page toggles `documentsUploaded`, `livenessPassed`, and
  `profileApproved` checks.
- `completeChecks()` creates a pre-authorized credential offer URI.
- The wallet redeems the offer through token and credential requests.
- The credential response carries `midnight_compact_vc` with
  `compact-value-v1.base64url` encoded credential and proof payloads.

Mocked or simplified:

- Document upload, liveness, and human approval are buttons.
- JWT proof-of-possession is placeholder text.
- Issuer DID and JubJub key are deterministic fixtures.

Production readiness gaps:

- Replace buttons with real KYC and liveness providers.
- Implement authorization server behavior and proof-of-possession validation.
- Resolve issuer DID keys instead of relying on local fixtures.
- Add issuer audit logs, retry semantics, and user cancellation handling.

## UC-4: Present National ID To Screening Issuer

Before Screening issuance starts, the wallet builds an explicit National ID VP
payload and gives it to the Screening issuer. The issuer no longer treats the
wallet inventory as implicit context.

Low-level implementation:

| Detail | Location |
|---|---|
| VP payload type | `src/types.ts` |
| Wallet VP builder | `src/actors/wallet.ts` |
| Bridge method | `src/bridge/wallet-bridge.ts` |
| Screening session start | `src/app-session.ts` |
| VP decode and validation | `src/issuers/screening-issuer-service.ts` |
| Compact codecs | `packages/credentials-passport-secret/src/codecs.ts` |
| Tests | `src/test/screening-issuer-service.test.ts` |

Protocol and data shape:

- `createNationalIdPresentationForScreening()` builds a
  `NationalIdPresentationSubmission`.
- The VP token includes `format: "midnight_compact_vp"`, family
  `passport-secret`, schema `national-id-proxy:v1`, encoded credential,
  encoded issuer proof, encoded presentation, and holder-binding metadata.
- The Screening issuer decodes the Compact values and verifies that the
  presentation is anchored to the credential claim root.
- The Screening issuer validates holder-binding method, challenge, and blinded
  commitment before opening a session.

Mocked or simplified:

- The submission still includes `prototypeFixture` so local pure-circuit
  simulation can run without a production ZK proof transport.
- The VP does not yet travel through full OID4VP redirect or direct-post
  protocol.

Production readiness gaps:

- Replace `prototypeFixture` with proof artifacts, verifier-request state, and
  issuer-resolved DID key material.
- Add OID4VP/SIOP request and response transport.
- Define replay protection, expiry, and holder consent UX.

## UC-5: Issue Screening VC

The Screening issuer verifies the National ID VP session context, runs mocked
sanctions/PEP/profile checks, returns a credential offer, and issues a Compact
Screening credential signed by its own JubJub key.

Low-level implementation:

| Detail | Location |
|---|---|
| Screening issuer agent | `src/actors/compliance-issuer.ts` |
| Screening service | `src/issuers/screening-issuer-service.ts` |
| Shared OID4VCI session helpers | `src/issuers/issuer-session.ts` |
| Screening browser page | `app/screening-issuer.html`, `app/screening-issuer.js` |
| Credential family | `packages/credentials-compliance` |
| Tests | `src/test/screening-issuer-service.test.ts`, `src/e2e/passport-prototype.spec.ts` |

Protocol and data shape:

- `ScreeningIssuerService.start()` requires a validated National ID VP payload.
- The issuer page toggles `sanctionsChecked`, `pepChecked`, and
  `profileApproved` checks.
- `completeChecks()` creates a Screening credential offer URI.
- The wallet redeems the offer through token and credential requests.
- `ComplianceIssuerAgent.screenAndIssue()` validates the National ID
  presentation with passport-secret pure circuits before issuing.

Mocked or simplified:

- Sanctions and PEP checks are local buttons.
- Provider matching data is not modeled.
- JWT proof validation is placeholder text.

Production readiness gaps:

- Integrate real sanctions and PEP providers.
- Add policy versioning, review workflow, and provider evidence retention.
- Replace fixture DID keys with DID resolution.
- Validate credential request proof and anti-replay state.

## UC-6: Deny Screening Issuance

The Screening issuer can deny the session when sanctions or PEP checks fail.
No credential offer is returned, and the wallet remains without a Screening VC.

Low-level implementation:

| Detail | Location |
|---|---|
| Denial state and reason | `src/issuers/screening-issuer-service.ts` |
| Denial API route | `src/serve-app.ts` |
| Browser controls | `app/screening-issuer.html`, `app/screening-issuer.js` |
| Browser coverage | `src/e2e/passport-prototype.spec.ts` |

Protocol and data shape:

- `deny({ reason: "sanctions_match" | "pep_match" })` marks the issuer
  session as `denied`.
- Denied sessions reject `completeChecks()`.
- The issuer page disables completion and shows the denial reason.
- Returning to the wallet does not create a credential offer or Screening VC.

Mocked or simplified:

- Denial is deterministic button state.
- There is no provider payload or human review queue.

Production readiness gaps:

- Add structured denial codes.
- Support retry, review, appeal, and privacy-preserving user messages.
- Define retention rules for compliance provider evidence.

## UC-7: Prepare Investment Proof

The wallet creates verifier-scoped National ID and Screening presentations for
an investment verifier. The proof bundle demonstrates age threshold,
not-expired, PASS, PEP=false, screening freshness, and same-holder predicates.

Low-level implementation:

| Detail | Location |
|---|---|
| DApp proof request | `src/actors/dapp.ts` |
| Wallet proof construction | `src/actors/wallet.ts` |
| Verifier requirements and challenge | `src/actors/investment-verifier.ts` |
| Passport credential circuits | `packages/credentials-passport-secret` |
| Screening credential circuits | `packages/credentials-compliance` |
| Tests | `src/test/lace-wallet-use-cases.test.ts`, `src/test/prototype-flow.test.ts` |

Protocol and data shape:

- The verifier creates a challenge from the wallet profile and product.
- The wallet updates presentation requests with verifier-specific requirements.
- The wallet derives verifier-scoped pseudonyms from the holder secret and
  verifier domain hash.
- The final `InvestmentProofBundle` contains both credential families and one
  verifier challenge.

Mocked or simplified:

- The verifier is an in-process simulator, not a deployed Midnight contract.
- Proof transport is direct TypeScript object passing.

Production readiness gaps:

- Deploy or integrate a real verifier contract.
- Define DApp-to-wallet proof request transport.
- Encode proof artifacts for HTTP/wallet handoff.
- Add verifier policy discovery and user consent screens.

## UC-8: Approve And Settle Investment

The DApp submits the proof bundle to the verifier contract stub. If approved,
it asks the external crypto wallet stub to settle the investment payment.

Low-level implementation:

| Detail | Location |
|---|---|
| Verifier decision | `src/actors/investment-verifier.ts` |
| DApp orchestration | `src/actors/dapp.ts`, `src/app-session.ts` |
| External crypto wallet | `src/actors/crypto-wallet.ts` |
| Browser assertions | `src/e2e/passport-prototype.spec.ts` |

Protocol and data shape:

- The verifier returns either an approved decision with a participation
  commitment or a denial reason.
- Settlement is allowed only after approval.
- Payment uses a separate wallet actor to keep identity proofing and payment
  authority separate.

Mocked or simplified:

- The external crypto wallet is a balance/transfer stub.
- There is no chain transaction, wallet prompt, or signature.

Production readiness gaps:

- Integrate Lace or another wallet API.
- Construct and sign real transactions.
- Handle insufficient funds, pending settlement, cancellation, and receipts.

## UC-9: Browser Happy Path

Playwright exercises the full approved user journey through browser-visible
controls and backend state.

Low-level implementation:

| Detail | Location |
|---|---|
| App shell | `app/index.html`, `app/app.js`, `app/styles.css` |
| TypeScript server | `src/serve-app.ts` |
| Browser test | `src/e2e/passport-prototype.spec.ts` |
| Playwright config | `playwright.config.ts` |

Protocol and data shape:

- The browser flow uses the same HTTP endpoints as manual testing.
- Redirects go to issuer pages and return through wallet callback URLs.
- Assertions cover wallet status, issuer DID display, credential status,
  proof state, and settlement summary.

Mocked or simplified:

- All actors run in one local Node.js process.
- Issuer pages and wallet are same-origin in the prototype server.

Production readiness gaps:

- Split actors into deployable services.
- Use real cross-origin redirect URLs.
- Add observability, persisted sessions, correlation ids, and error pages.

## UC-10: Browser Denied Paths

Playwright covers both the shortcut denied flow and the issuer-side sanctions
denial flow.

Low-level implementation:

| Detail | Location |
|---|---|
| Shortcut denied path | `src/app-session.ts`, `src/actors/compliance-issuer.ts` |
| Issuer-side sanctions denial | `app/screening-issuer.js`, `src/issuers/screening-issuer-service.ts` |
| Browser coverage | `src/e2e/passport-prototype.spec.ts` |

Protocol and data shape:

- `runDeniedPath` demonstrates direct actor denial before proof creation.
- The Screening issuer denial path demonstrates user-visible issuer denial
  before returning a credential offer.
- In both cases, the wallet cannot prepare an investment proof.

Mocked or simplified:

- Provider outcomes are deterministic.
- Denial state is not persisted beyond the local session.

Production readiness gaps:

- Add expired session, callback replay, malformed offer, and cancellation tests.
- Define user recovery UX.
- Define compliance evidence and audit retention policy.

## Actor Boundaries

| Actor | Prototype module | Production direction |
|---|---|---|
| Passport wallet | `src/actors/wallet.ts`, `src/bridge/wallet-bridge.ts` | Browser extension, mobile wallet, or Lace integration replacing `WalletBridge` |
| National ID issuer | `src/issuers/national-id-issuer-service.ts`, `app/national-id-issuer.*` | Independent OID4VCI issuer with real identity proofing |
| Screening issuer | `src/issuers/screening-issuer-service.ts`, `app/screening-issuer.*` | Independent OID4VCI issuer with real compliance providers |
| DApp verifier | `src/actors/dapp.ts` | Web DApp using OID4VP/SIOP-style requests |
| Verifier contract | `src/actors/investment-verifier.ts` | Midnight smart contract or contract-backed service |
| External wallet | `src/actors/crypto-wallet.ts` | Lace or another payment wallet API |

## Protocol Coverage

| Protocol area | Implemented today | Notes |
|---|---|---|
| OID4VCI-shaped issuance | Credential offer URI, pre-authorized token request, credential request, credential response | Shared issuer-session plumbing lives in `src/issuers/issuer-session.ts`. |
| OID4VP-shaped presentation | Domain types and prototype National ID VP payload | Full redirect/direct-post VP transport is still future work. |
| Compact value transport | `compact-value-v1.base64url` encoded Compact values | Avoids JSON corruption of generated Compact structures. |
| DID/key model | Prototype Midnight DIDs and JubJub issuer methods | DID resolution and key lifecycle are stubbed by deterministic fixtures. |
| Holder binding | Blinded holder commitment and challenge response | Production needs real proof payloads instead of simulator fixture context. |

## Notes For Future Iterations

- Keep generic protocol and credential helpers outside `midnight-passport-prototype` when they are reusable.
- Keep Passport-specific credential families and actor wiring inside `midnight-passport-prototype`.
- Update this document whenever a use case becomes executable, gets renamed, or changes its mocked/production boundary.
- Prefer adding a browser E2E path when a user-facing flow changes, and a TypeScript service test when protocol/session behavior changes.
