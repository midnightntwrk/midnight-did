# DID Manager Sign & Verify tab: FRD + ADR

## Status
Proposed

## Metadata
- Date: 2026-04-10
- Issue: https://github.com/midnightntwrk/midnight-did/issues/63
- Branch: `feat/63-sign-verify-tab`

## Goal
Add a new `Sign & Verify` tab to the DID Manager demo so a user can:

- sign detached payloads with a private key associated with the active Midnight DID
- verify detached payloads with the corresponding public key
- verify signatures against a verification method from another Midnight DID, including a DID owned by a different local profile

The demo must support all currently supported key types:

- `Jubjub`
- `Ed25519`
- `P-256`

## Why this belongs in the demo app
The repository already contains the main building blocks:

- local key custody and curve-specific signing in `secret-storage/`
- DID document publication and resolution in `api/`, `did/`, and `did-resolver-service/`
- a DID Manager UI intended to demonstrate end-to-end package usage

The missing piece is a user-facing flow that proves an off-chain payload can be signed by a DID-associated private key and then verified using public key material resolved from the DID document.

## Scope

### In scope
- New DID Manager tab for detached payload signing and verification
- Support for three payload modes:
  - raw bytes
  - UTF-8 string
  - JSON
- JSON canonicalization before signing and verification
- Local signing with a selected key from the current profile
- Local verification with a local key reference or local public JWK
- DID-based verification using a verification method identifier from the resolved DID document
- Cross-profile verification using a DID from another local profile
- Tests and documentation for all supported curves

### Out of scope for the first delivery
- JWS/JWT issuance
- W3C Data Integrity proof envelopes
- Verifiable Credentials
- Historical verification against an older DID state
- Multi-signer or multisig workflows
- Browser wallet signing

## Functional requirements

### FR-1: new UI surface
The DID Manager must expose a new primary tab named `Sign & Verify`.

### FR-2: supported payload types
The tab must let the user choose one of three payload input modes:

- `bytes`
- `string`
- `json`

### FR-3: payload-to-bytes conversion
The demo must transform each payload mode into deterministic bytes before signing or verification:

- `bytes`: accept hex input in the UI and decode it to raw bytes
- `string`: encode the exact entered text as UTF-8, with no trimming or Unicode normalization
- `json`: parse JSON and canonicalize it according to RFC 8785 JCS, then UTF-8 encode the canonical JSON string

### FR-4: signing
The demo must let the user sign using a private key stored in the active profile's secret store.

Signing must only be allowed when:

- a local session is active
- a DID contract is selected and resolved for the current profile
- the selected local key belongs to the active DID in secret-store metadata
- the public key for that local key is present in the current DID document as a verification method

### FR-5: verification
The demo must support verification using either:

- a local key reference from the current profile, or
- an explicit public JWK supplied by the operator, or
- a verification method identifier from a Midnight DID document

### FR-6: cross-profile verification
The demo must allow the operator to switch to a different local profile and still verify a previously signed payload by using the verification method identifier of a DID owned by another profile.

This verification path must resolve the DID document and extract the public key from the resolved DID state. It must not depend on the original signing profile still being selected.

### FR-7: supported curves
The demo must support sign and verify for:

- `EC/Jubjub`
- `OKP/Ed25519`
- `EC/P-256`

### FR-8: verification result details
The UI and API must surface:

- whether verification succeeded
- the resolved verification method identifier
- the curve and key type used
- the payload mode
- the canonical payload bytes used for verification
- the signature encoding/format

### FR-9: meaningful errors
The API and UI must fail with clear messages when:

- the key is not associated with the active DID
- the selected key is not published in the DID document
- the verification method identifier is malformed
- the DID cannot be resolved
- the resolved DID document does not contain the referenced verification method
- the signature encoding is incompatible with the resolved curve
- the JSON input is invalid or not canonicalizable under the chosen rules

### FR-10: network consistency
Verification by DID must only resolve DIDs on the network configured for the running manager setup. A mismatch between the configured setup network and the target DID network must be rejected.

## UX requirements

### UX-1: two-pane workflow
The tab should present separate but adjacent areas:

- `Sign`
- `Verify`

### UX-2: explicit verification target
The verify pane should accept an absolute Midnight verification method identifier, for example:

`did:midnight:preprod:<contract-address>#key-1`

This is more precise than using only a DID or only a local key reference.

### UX-3: transparent canonicalization
For JSON mode, the UI should show the canonical JSON representation used for signing and verification so the operator can see exactly what bytes are signed.

### UX-4: demo-oriented feedback
The UI should show:

- signature value in base64url
- signature format label
- resolved DID subject
- resolved method id
- local versus DID-resolved verification source

### UX-5: round-trip demo affordance
The tab should provide a `Copy Sign Result to Verify` action that copies the latest sign result into the verify form.

This is not a protocol requirement, but it makes the demo substantially easier to exercise and reduces manual copy/paste errors during walkthroughs.

### UX-6: safe control gating
The sign controls must be disabled until the session and DID are ready. The verify controls may remain available when the session is closed, as long as DID resolution is available from the configured read-only network endpoints.

## Research

### Existing repository capabilities

#### Secret storage already supports all needed curves
`secret-storage` already supports:

- `Ed25519`
- `P-256`
- `Jubjub`

Relevant code paths:

- `secret-storage/src/file-secret-store.ts`
- `secret-storage/src/curve-support.ts`
- `secret-storage/src/types.ts`

The current API already provides:

- `sign({ keyRef, payload })`
- `verify({ keyRef?, publicJwk?, payload, signature })`

This means the feature does not need new curve math for v1. It needs orchestration, payload normalization, DID resolution, and a clearer signature contract.

#### DID resolution already exists in two reusable forms
The repository already has a read-only DID resolution path:

- `did/src/midnight-did-resolver.ts`
- `did-resolver-service/src/service.ts`

`did-resolver-service` is the better architectural reference for cross-profile verification because it resolves through indexer public data and does not depend on an unlocked wallet session.

#### The manager closes runtime state on profile switch
The current DID Manager session model closes the active runtime session when the profile changes. This is the correct behavior for session isolation, but it means cross-profile verification cannot rely on the original wallet runtime still being active.

That directly drives the architecture decision to verify remote DIDs through a read-only DID resolution path.

### Standards and external references

#### JSON canonicalization
RFC 8785 defines the JSON Canonicalization Scheme (JCS):

- https://www.rfc-editor.org/rfc/rfc8785

Why this is the right fit:

- detached signatures need invariant bytes
- JCS keeps JSON as JSON instead of forcing an envelope rewrite
- it defines deterministic property sorting and serialization rules
- it aligns well with off-chain signing demos and readable payloads

Important constraints from RFC 8785:

- canonicalization builds on ECMAScript JSON serialization
- data must conform to the I-JSON subset
- duplicate property names are not allowed
- strings must be preserved as-is, without Unicode normalization

Practical implementation note:

- prefer a small RFC 8785 implementation rather than hand-rolling canonicalization logic
- current leading candidate: `canonicalize` from npm, which explicitly targets RFC 8785, has no runtime dependencies, and uses an Apache-2.0 license
- if dependency policy rejects a new package, the fallback should be a minimal internal wrapper with tests copied from RFC-style examples

#### DID verification relationships
DID Core defines how verification methods are used and how a verifier checks them:

- https://www.w3.org/TR/did-1.0/

Relevant points:

- verification methods are declared in the DID document
- relationships such as `authentication` and `assertionMethod` determine allowed proof purposes
- a verification method missing from the latest resolved DID document is considered invalid or revoked

For this feature, the main value is key resolution and proof verification, not proof-purpose enforcement. That informs the v1 decision below.

### Repository-specific DID behavior
The Midnight DID method documentation in this repository states that verification method identifiers are stored in normalized fragment form on-ledger and emitted as canonical absolute DID URLs during resolution:

- `w3c-spec/midnight-method.md`

That makes the absolute verification method identifier the correct portable identifier for cross-profile verification.

## Architecture decisions

### ADR-1: deliver detached signatures, not JWS or Data Integrity
The first implementation will sign and verify raw detached payload bytes.

Reasoning:

- the current repository already provides raw sign/verify primitives
- JWS and Data Integrity would add envelope semantics, algorithm negotiation, and proof-purpose rules that are not required for the demo goal
- detached signatures keep the feature focused on DID key resolution and payload normalization

### ADR-2: use RFC 8785 JCS for JSON payloads
JSON payload mode will canonicalize using RFC 8785 before signing and verification.

Reasoning:

- it provides deterministic bytes for structurally equivalent JSON
- it avoids ad hoc `JSON.stringify()` behavior across inputs
- it is a recognized canonicalization scheme for cryptographic JSON usage

### ADR-3: use absolute verification method identifiers as the public-key lookup handle
Verification by DID will use an absolute method id such as:

`did:midnight:<network>:<contract>#key-1`

The system will:

1. parse the DID from the method id
2. resolve the DID document
3. find the matching verification method
4. verify the signature with the resolved public key

Reasoning:

- the identifier is stable across profiles
- it matches DID Core semantics
- it avoids ambiguous local-only references

### ADR-4: cross-profile verification must use a read-only resolver path
Verification using a DID method id must not require the wallet runtime or the signing profile to remain active.

Implementation should reuse resolver-style read-only access based on the configured setup's indexer endpoints.

Reasoning:

- switching profiles currently closes the active runtime session
- verification only needs the resolved public key, not private state or proof generation
- read-only resolution is faster and operationally safer

### ADR-5: v1 signs with DID-associated keys but does not enforce a DID Core proof purpose
For v1, a key is valid for signing in the demo if:

- the local key metadata points to the active DID, and
- the key's public JWK is present in the resolved DID document's `verificationMethod` set

The demo will not require the method to be under `authentication`, `assertionMethod`, or another specific relationship in the first delivery.

Reasoning:

- the user requirement is generic payload signing, not a specific DID Core proof purpose
- DID Core relationships matter when the application assigns a purpose to the proof
- the demo should stay generic and avoid implying a specific VC/authentication model

Follow-up option:

- add an optional `proofPurpose` field later and enforce the corresponding relationship during verification

### ADR-6: signature output must expose explicit encoding metadata
The feature must not keep the current ambiguous `format: "raw"` contract as the public API for this flow.

At minimum, the sign/verify result model must expose one of:

- `ed25519-raw`
- `jubjub-raw-96`
- `ecdsa-der`

Reasoning:

- the current `secret-storage` type claims `format: "raw"` for all curves
- `P-256` currently signs through Node.js ECDSA and returns DER-encoded output
- verification and interop become error-prone if the API hides the actual encoding

This change can be implemented either by:

- expanding `secret-storage` signature metadata, or
- wrapping existing storage output in a manager-level signature envelope

### ADR-7: represent payloads and signatures as base64url at the API boundary
The manager API should return and accept:

- canonical payload bytes as base64url
- signatures as base64url

Reasoning:

- it is compact and URL-safe
- it avoids lossy transport for binary signatures
- it works uniformly across all curves

The UI may still accept bytes as hex for operator friendliness.

### ADR-8: prefer a standards-based JSON canonicalization library over a custom implementation
The implementation should use a small RFC 8785-compatible library instead of introducing custom canonicalization code unless repository policy explicitly disallows the dependency.

Reasoning:

- canonicalization bugs are subtle and security-relevant
- this feature needs predictable behavior more than custom flexibility
- the repository already has enough feature code; adding one well-scoped library is lower risk than inventing a new canonicalizer

## Proposed API and UI model

### UI tab
New primary tab:

- `Sign & Verify`

### Sign request
Proposed manager API shape:

```json
{
  "keyRef": "local-secret-ref",
  "payloadType": "bytes",
  "payload": "deadbeef",
  "payloadEncoding": "hex"
}
```

```json
{
  "keyRef": "local-secret-ref",
  "payloadType": "string",
  "payload": "hello midnight"
}
```

```json
{
  "keyRef": "local-secret-ref",
  "payloadType": "json",
  "payload": {
    "b": 1,
    "a": 2
  }
}
```

### Sign response
```json
{
  "did": "did:midnight:preprod:<contract>",
  "verificationMethodId": "did:midnight:preprod:<contract>#key-1",
  "keyRef": "local-secret-ref",
  "algorithm": {
    "kty": "EC",
    "crv": "Jubjub"
  },
  "payloadType": "json",
  "canonicalPayloadBase64Url": "<bytes>",
  "signatureBase64Url": "<signature>",
  "signatureFormat": "jubjub-raw-96"
}
```

### Verify request
The verify API should accept either a local or DID-resolved verification source.

Local source:

```json
{
  "source": "local",
  "keyRef": "local-secret-ref",
  "payloadType": "string",
  "payload": "hello midnight",
  "signatureBase64Url": "<signature>",
  "signatureFormat": "ed25519-raw"
}
```

DID-resolved source:

```json
{
  "source": "did",
  "verificationMethodId": "did:midnight:preprod:<contract>#key-1",
  "payloadType": "json",
  "payload": {
    "a": 2,
    "b": 1
  },
  "signatureBase64Url": "<signature>",
  "signatureFormat": "ecdsa-der"
}
```

### Verify response
```json
{
  "verified": true,
  "source": "did",
  "did": "did:midnight:preprod:<contract>",
  "verificationMethodId": "did:midnight:preprod:<contract>#key-1",
  "algorithm": {
    "kty": "EC",
    "crv": "P-256"
  },
  "canonicalPayloadBase64Url": "<bytes>"
}
```

## Implementation plan

### 1) Add payload normalization helpers
Create a dedicated module in the manager service, for example:

- `did-manager-service/src/signatures/payload-normalization.ts`

Responsibilities:

- parse input by payload type
- decode hex for `bytes`
- encode strings as UTF-8
- canonicalize JSON with RFC 8785 JCS
- return canonical bytes plus display-friendly metadata

Tests:

- equivalent JSON objects yield identical canonical bytes
- RFC 8785 edge cases are covered, including nested objects, arrays, number serialization behavior, and Unicode/control-character escaping
- malformed JSON fails clearly
- byte parsing rejects invalid hex

### 2) Add signature-domain types
Create manager-level types for:

- `PayloadType`
- `SignatureFormat`
- `SignPayloadRequest`
- `SignPayloadResult`
- `VerifyPayloadRequest`
- `VerifyPayloadResult`

These should live outside the UI so API, tests, and the manager service share one contract.

### 3) Add DID verification-method resolution helpers
Create a reusable read-only resolution helper, preferably in the manager service first and later extractable if needed:

- `did-manager-service/src/signatures/did-verification-method.ts`

Responsibilities:

- parse absolute verification method id
- derive DID subject from the method id
- resolve the DID document using a read-only resolver path
- locate the matching verification method entry
- convert the resolved method to the `PublicJwk` shape expected by `secret-storage.verify`

Implementation note:

- reuse the `MidnightDIDResolver` pattern from `did-resolver-service/src/service.ts`
- do not require an unlocked wallet session for this path

### 4) Add manager service methods
Extend `DidManagerService` with:

- `signPayload(...)`
- `verifyPayload(...)`

Signing responsibilities:

- require an active session
- require an active DID contract
- require a local key
- match local key metadata to the active DID
- resolve current DID document
- ensure the key is published as a verification method
- normalize payload
- sign with secret storage
- return explicit signature metadata

Verification responsibilities:

- normalize payload
- verify by local key or DID-resolved key
- return verification details and resolved method metadata

### 5) Add API routes
Extend `did-manager-service/src/app.ts` and `did-manager-service/src/http/schemas.ts` with:

- `POST /api/signatures/sign`
- `POST /api/signatures/verify`

Optional helper route if the UI benefits from it:

- `POST /api/signatures/resolve-method`

### 6) Add the new UI tab
Update:

- `did-manager-service/src/ui/page.ts`
- add `did-manager-service/src/ui/signatures-content.ts`
- extend `did-manager-service/src/ui/script.ts`

UI capabilities:

- select payload type
- input payload
- pick local signing key from the current DID
- display signature output
- paste absolute verification method id
- verify locally or by DID
- show canonical JSON preview and verification results

### 7) Tighten signature format handling in secret storage
Refine the signing contract in `secret-storage` so curve-specific signature encoding is explicit.

Minimum required cleanup:

- replace ambiguous `format: "raw"` with an explicit format enum, or
- document and wrap the existing encoding with manager-level metadata

Tests must prove:

- `Ed25519` sign/verify round-trips
- `Jubjub` sign/verify round-trips
- `P-256` sign/verify round-trips with the declared encoding

### 8) Add tests

#### Unit tests
- payload normalization
- method-id parsing and DID extraction
- DID verification-method lookup
- signature format mapping

#### Manager/API tests
- sign and verify for all three curves
- JSON canonicalization succeeds when object key order differs
- verification fails when the key is removed from the DID document
- verification succeeds from another profile using the same setup network

#### Playwright/demo tests
- create or reuse two profiles
- sign with profile A
- switch to profile B
- verify with profile A's verification method id

### 9) Documentation
Update:

- DID Manager documentation in `docs-site/`
- `secret-storage` docs if signature metadata changes
- architecture docs if the resolver helper becomes shared infrastructure

## Deliverable phases

### Phase 1: canonical payload pipeline
- add payload normalization helpers for `bytes`, `string`, and `json`
- integrate RFC 8785 canonicalization through a small standards-based library
- add unit tests for canonicalization edge cases and payload decoding

### Phase 2: manager sign/verify backend
- add manager-level sign/verify types
- add manager service methods for detached signing and verification
- expose explicit signature format metadata rather than relying on implicit `"raw"`
- add API routes and request schemas

### Phase 3: DID-based verification resolution
- add read-only resolution of verification methods by absolute Midnight method id
- ensure this path works without the original signing session remaining active
- add tests for cross-profile verification and DID lookup failures

### Phase 4: DID Manager UI tab
- add `Sign & Verify` as a primary tab
- implement sign and verify panes
- add `Copy Sign Result to Verify`
- surface canonical payload bytes, signature format, and resolution source

### Phase 5: end-to-end validation and documentation
- add route tests and Playwright coverage
- update docs-site guides for the new tab and payload model
- document the limits of detached verification against the current resolved DID state

## Acceptance criteria
- The DID Manager has a working `Sign & Verify` tab.
- The demo signs and verifies payloads for `Jubjub`, `Ed25519`, and `P-256`.
- JSON payloads verify successfully even when semantically equivalent input uses different property ordering.
- Verification by absolute Midnight verification method id works after switching to another profile.
- DID-based verification does not require an unlocked wallet session for the original signing profile.
- The result model exposes the actual signature encoding used.
- Tests cover the three curves, the three payload modes, and the cross-profile verification flow.

## Open questions
- Should v1 accept only absolute verification method ids, or also support separate DID + fragment inputs in the UI?
- Should `bytes` mode support both `hex` and `base64url`, or keep `hex` only for the first UI iteration?
- Do we want to enforce a specific proof purpose later, such as `assertionMethod`, for application-specific flows?
- Should `P-256` eventually expose JOSE-style raw `r || s` signatures for interoperability, or keep DER and make the encoding explicit?

## Recommended next step
Implement this as a manager-only feature first, but keep the DID resolution helper isolated and reusable so it can later be promoted into a shared package or reused by the resolver service if detached-signature verification becomes part of the broader platform surface.
