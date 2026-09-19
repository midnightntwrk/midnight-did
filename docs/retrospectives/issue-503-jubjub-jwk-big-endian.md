# Issue #503 Jubjub JWK coordinate retrospective

Date: 2026-09-19
Canonical tracker: [midnightntwrk/midnight-did#503](https://github.com/midnightntwrk/midnight-did/issues/503)

## What prompted the work

Midnight DID 0.6 projected native ledger Jubjub points into `EC` JWK `x` and
`y` members as fixed-width little-endian bytes. That matched Midnight's native
field serialization and existing consumers, but not the SEC1 big-endian
coordinate representation required by RFC 7518 for those JWK members. With
0.6.0 already published and limited production adoption, the maintainers chose
an intentional 0.7 representation break rather than retaining or extending the
non-standard transport convention.

## What worked

- Primary-source review connected RFC 7518's `x`/`y` requirements to SEC1's
  integer-to-octet conversion and kept the unregistered `Jubjub` curve-name
  limitation separate from coordinate correctness.
- Endian-explicit codecs in the domain package give producers and consumers one
  public fixed-width boundary instead of duplicating byte-reversal helpers.
- Literal vectors for small asymmetric values and a deterministic real Jubjub
  key prevent encode/decode lockstep from hiding an endian regression.
- Field-bound validation rejects coordinate aliases before they can be reduced
  or interpreted differently by downstream cryptographic implementations.
- The review identified that offchain MOD1 already had immutable historical
  little-endian wire semantics. Converting at its domain boundary preserves
  existing payload bytes and DID hashes while exposing only canonical 0.7 JWKs.
- The Compact contract, native ledger point, method identifiers, relationships,
  and Schnorr transcript remain unchanged; no managed artifact migration is
  needed.

## Friction, failures, and configuration drift

- The original issue referred to helper names that no longer existed. The
  current `decodeBase64UrlBytes32` helper is byte-only, while the actual
  little-endian projection lived privately in `LedgerToDomain` and API tests.
- The first implementation treated MOD1 strings as opaque under both profiles.
  Security review correctly found that the unchanged wire tag would leave old
  and new offchain Jubjub points ambiguous. The final design fixes `keyKind = 1`
  as legacy little-endian wire data and performs one deterministic reversal at
  encode/decode boundaries.
- The first codec boundary enforced only unsigned 256-bit width. Review found
  that this admitted integers outside the Jubjub base field, so the codec and
  JWK schema now reject values at or above the field modulus.
- Running Prettier across existing Markdown reformatted large unrelated areas of
  the method specification. Those changes were reverted and the semantic edits
  were reapplied narrowly.
- The first visual-docs run found mobile overflow from the unbroken decimal
  field modulus. Moving the value into a contained code block preserved the
  normative constant and restored the mobile layout.
- The exact-head draft gate then found that the new 0.7 status prose no longer
  contained validator-required bounded 0.6 conformance sentences. The status
  now retains those exact published-baseline claims while separately scoping
  the 0.7 draft in both status and abstract, and `docs:validate` passes again.
- A direct DID-package test initially failed because the contract package had
  not been built in the fresh worktree. Building the documented prerequisite
  restored the focused lane.
- The conformance runner intentionally refuses a dirty tracked worktree. It must
  run after the signed implementation commit rather than as an uncommitted
  focused check.
- pnpm emitted the repository's known warning that committed project-level npm
  credentials are ignored; frozen-lockfile installation and all local package
  operations otherwise remained deterministic.

## Validation and review evidence

Focused domain and DID suites cover canonical base64url, exact 32-byte width,
big-endian vectors, the base-field boundary, mapper error translation, complete
DID resolution envelopes, MOD1 wire/hash stability, and the public package
surface. The full Docker-backed API integration suite proves that a deterministic
seed's resolved coordinates reconstruct the original native point and verify its
Schnorr signature through both local and ledger-bound paths. Package builds,
package-content smoke checks, docs validation, and the VitePress build/visual
checks also pass. Mandatory repository verification, exact-head CI, commit
integrity, and routed review are recorded separately on the pull request.

## Follow-ups

- [`midnight-did-resolver#123`](https://github.com/midnightntwrk/midnight-did-resolver/issues/123)
  tracks secret-storage generation/decoding and atomic resolver-replica rollout
  before producing DID 0.7 documents.
- [`midnight-verifiable-credentials#660`](https://github.com/midnightntwrk/midnight-verifiable-credentials/issues/660)
  tracks the explicit 0.7 credential-binding decoder, vectors, and native-root
  compatibility evidence. VC PR #659 remains scoped to DID 0.6 behavior.
- IANA registration of the Jubjub curve name and any Schnorr algorithm remains
  separate standards work; big-endian coordinates do not make the private curve
  generally available in JOSE libraries.
- Additional Jubjub point, subgroup, identity, and signature-canonicality
  hardening remains outside this transport-codec change and requires dedicated
  security triage.
