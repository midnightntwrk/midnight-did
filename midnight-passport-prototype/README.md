# Midnight Passport Prototype

Status: executable prototype workspace

This directory is for the proof-of-concept implementation of the Lace Wallet +
Midnight Passport DApp flows described in:

- `research/lace-wallet-midnight-dapp-brd-frd.md`
- `research/lace-wallet-midnight-dapp-gap-analysis.md`

The prototype should remain close to production architecture while avoiding
premature product commitments. It is allowed to run as a single standalone app
first, with issuer, wallet, DApp, verifier contract, and external crypto wallet
stub all co-located for fast iteration.

Generic reusable credential packages stay at the repository root. Credential
families that exist to validate the Midnight Passport product shape live under
`midnight-passport-prototype/packages`.

## Recommended Prototype Shape

Start with a standalone SPA, not a Chrome extension.

Reasoning:

- A standalone SPA is faster to build and test with Playwright.
- All actors can be emulated in one process without extension permissions,
  browser messaging, or installation friction.
- The domain seams can still be designed so a Chrome extension or mobile wallet
  can replace the in-app wallet panel later.

The SPA should emulate these actors:

| Actor | Prototype component |
|---|---|
| Lace Wallet | Wallet panel + encrypted local store + VC store |
| National ID Issuer | Redirect-based issuer page using mocked checks and OID4VCI-shaped exchange |
| Sanction Screening Issuer | Compliance issuer emulator using `packages/credentials-compliance` |
| Midnight Passport DApp | Product and proof request UI |
| Investment Contract | Compact simulator-backed verifier |
| External Crypto Wallet | Stubbed EIP-1193-style wallet with balances and transfer confirmation |

## Documents

- `prototype-plan.md` — staged implementation plan and acceptance criteria
- `midnight-passport-use-cases.md` — living use-case matrix with low-level
  implementation details, mocked boundaries, leftovers, and
  production-readiness notes
- `app/` — styled browser shell based on the Midnight style kit
- `src/app-session.ts` — TypeScript session backend that drives the browser flow
- `src/issuers/national-id-issuer-service.ts` — redirect-based Digital National
  ID issuer service
- `src/issuers/screening-issuer-service.ts` — redirect-based Screening VC
  issuer service

## Run The Browser Prototype

The browser prototype is served by the TypeScript workspace server. The page is
not a standalone mock: its buttons call `/api/actions/*`, and those actions use
the same wallet, issuer, verifier, and external wallet actors covered by the
prototype tests.

Use the repository launcher:

```bash
./start-passport-prototype.sh
```

Open `http://127.0.0.1:5174`.

Or run the workspace server directly:

```bash
npm run app:serve -w midnight-passport-prototype
```

`prototype-state.json` is still generated for static fallback/documentation, but
the recommended mode is the TypeScript API-backed server.

The browser shell can run the flow manually:

1. initialize wallet with passkey-derived unlock material and a generated
   Midnight wallet seed
2. start Digital National ID issuance
3. redirect to the issuer page and complete mocked document/liveness/approval
   checks
4. return to the wallet with a credential offer URI
5. redeem the offer through token and credential request/response messages
6. start Screening VC issuance
7. wallet receives an OID4VP-style Screening request redirect with a
   `request_uri`, client identifier, verifier-domain hints, and a request id
8. wallet renders an explicit consent step before any National ID VP leaves the
   wallet
9. wallet builds a National ID VP payload for the Screening issuer with encoded
   credential, issuer proof, presentation request, and presentation
10. wallet posts that VP to the issuer `direct_post` endpoint
11. Screening issuer verifies the VP envelope, then opens the issuer page for
   mocked National-ID-presentation, sanctions, PEP, and approval checks
12. return to the wallet with a Screening VC credential offer URI
13. redeem the offer through token and credential request/response messages
14. prepare the verifier-scoped proof
15. approve the proof
16. settle through the external crypto wallet stub

It also includes a denied-path shortcut that demonstrates compliance rejection
before investment proof creation. The Screening issuer page also supports an
issuer-side denied path where sanctions or PEP checks can block the credential
offer before the wallet receives a Screening VC.

Browser API endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /api/state` | Return the current actor state, disclosure summary, protocol trace, and event log |
| `POST /api/actions/initializeWallet` | Create the passkey-derived secret/VC stores and generate a random wallet seed |
| `POST /api/actions/lockWallet` | Seal the wallet session while keeping encrypted stores persisted in memory |
| `POST /api/actions/unlockWallet` | Reopen the secure stores with passkey-derived unlock material |
| `POST /api/actions/issueNationalId` | Ask the National ID issuer actor for the passport proxy credential |
| `POST /api/actions/issueCompliance` | Legacy direct actor shortcut; browser flow uses issuer redirect instead |
| `POST /api/actions/approveScreeningConsent` | Local action-state hook for the wallet consent step |
| `POST /api/actions/prepareProof` | Build verifier-scoped Midnight presentations in the wallet |
| `POST /api/actions/approveProof` | Verify the proof bundle with the investment verifier contract stub |
| `POST /api/actions/settleInvestment` | Settle through the external crypto wallet stub after approval |
| `POST /api/actions/runHappyPath` | Execute the complete approved path |
| `POST /api/actions/runDeniedPath` | Execute the compliance-denied path |
| `POST /api/issuer/national-id/start` | Start a redirect-based Digital National ID issuer session |
| `GET /api/issuer/national-id/sessions/:id` | Read issuer-side mocked verification state |
| `POST /api/issuer/national-id/sessions/:id/checks/:check` | Mark a mocked issuer check as complete |
| `POST /api/issuer/national-id/sessions/:id/complete` | Return an OID4VCI credential offer URI to the wallet redirect URI |
| `POST /api/issuer/national-id/token` | Exchange the pre-authorized code for an access token |
| `POST /api/issuer/national-id/credential` | Exchange a credential request for a Midnight Compact credential response |
| `POST /api/issuer/national-id/redeem` | Wallet convenience endpoint that performs token + credential exchange for the returned offer |
| `POST /api/issuer/screening/start` | Start a redirect-based Screening VC issuer session |
| `GET /api/issuer/screening/requests/:id` | Return the Screening OID4VP-style authorization request bound to the issuer session |
| `POST /api/wallet/screening/authorization-response` | Build a wallet-approved National ID VP authorization response for a pending Screening request |
| `POST /api/issuer/screening/direct-post` | Deliver the approved National ID VP to the Screening issuer and mark the request as consumed |
| `GET /api/issuer/screening/sessions/:id` | Read screening issuer-side mocked verification state |
| `POST /api/issuer/screening/sessions/:id/checks/:check` | Mark a mocked screening check as complete |
| `POST /api/issuer/screening/sessions/:id/complete` | Return an OID4VCI Screening VC offer URI to the wallet redirect URI |
| `POST /api/issuer/screening/token` | Exchange the screening pre-authorized code for an access token |
| `POST /api/issuer/screening/credential` | Exchange a screening credential request for a Midnight Compact credential response |
| `POST /api/issuer/screening/redeem` | Wallet convenience endpoint that performs token + credential exchange for the returned screening offer |

The TypeScript wallet actor models session locking. Encrypted stores can exist
while the wallet is locked, but credential issuance and proof creation require a
successful unlock with passkey-derived material. In this prototype the passkey
PRF output is deterministic test material from `src/crypto/passkey.ts`; a
production wallet should obtain it from WebAuthn PRF or a platform secure
element and should not expose the PRF output to application code.

The wallet generates a random 32-byte Midnight wallet seed at initialization.
The seed is stored only inside the encrypted secret store; the UI exposes only a
hash/fingerprint so the flow can prove a seed exists without leaking it.

## Run The Actor Prototype

The TypeScript actor prototype exercises the real Midnight Credentials circuit
helpers through in-memory actors and validates OID4VCI/OID4VP-inspired envelopes
from `credentials-openid`:

- wallet with passkey-derived encrypted local stores and a generated wallet seed
- National ID issuer emulator with a Midnight DID and JubJub signing key
- redirect-based Digital National ID issuer page with mocked document,
  liveness, and profile-approval checks
- redirect-based Screening VC issuer page with mocked National ID proof,
  sanctions, PEP, and compliance-approval checks
- investment verifier contract stub
- external crypto wallet stub
- OID4VCI-style credential offer/request/response envelopes
- OID4VP-style presentation request redirect, wallet consent, direct-post
  response delivery, and presentation definition/submission envelopes

```bash
./run-passport-prototype.sh
```

Or run the package directly:

```bash
npm run all -w midnight-passport-prototype
```

Run only the browser e2e checks:

```bash
npm run test:e2e -w midnight-passport-prototype
```

If Chromium is not installed locally:

```bash
npm run playwright:install -w midnight-passport-prototype
```

## Style Kit Mapping

The current shell applies the style kit in these places:

- cinematic near-black ambient background
- purple/pink identity CTA gradient
- cyan/teal exploration and issuer accents
- glass cards with soft borders and blur
- mobile-first hero and consent surfaces
- explicit share / no-share disclosure panel
- calm proof approval interaction and event log

## Current Executable Flow

The current tests cover:

1. wallet store initialization from passkey-style PRF material
2. random Midnight wallet seed generation and encrypted storage
3. National ID proxy credential issuance from an issuer DID/JubJub signing method
4. explicit National ID VP payload handoff into the Screening issuer
5. wallet-mediated consent before the National ID VP is sent to the Screening issuer
6. single-use Screening request state with replay rejection on reused direct-post submissions
7. sanctions/PEP compliance credential issuance
8. investment proof creation with age, expiry, PASS, PEP=false, freshness, and
   same-holder predicates
9. settlement through a separate external crypto wallet stub
10. OpenID-shaped issuance and presentation envelopes carrying Midnight Compact payloads
11. browser e2e for approved and denied Passport prototype flows

The wallet keeps issued credential bodies and issuer proofs in its credential
inventory. When the DApp requests a proof, the wallet derives fresh
verifier-scoped presentations for the verifier challenge instead of minting new
credentials.

## Wallet Bridge Boundary

The prototype now routes DApp requests through `WalletBridge`:

- `InProcessWalletBridge` is used by the standalone prototype.
- The DApp asks the bridge for status, disclosure preparation, and proof
  submission.
- The bridge delegates to the wallet actor, which enforces locked/unlocked
  session state and credential inventory rules.

This is the seam a later Chrome extension, mobile wallet, or Lace integration
should replace. The DApp should not reach into wallet internals directly.

The prototype intentionally keeps browser extension messaging out of scope until
the actor boundaries and credential flow are stable.
