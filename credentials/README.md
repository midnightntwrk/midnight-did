# @midnight-ntwrk/midnight-did-credentials

Compact-first playground package for modeling Verifiable Credentials and Verifiable Presentations for Midnight.

## Purpose

This package is intentionally a research and PoC package, not a production credential standard.

It exists to force the VC/VP design through Compact constraints first:

- fixed-size types
- bounded disclosure layouts
- Compact-native verification method identifiers
- algorithm-specific proofs
- schema-specific credential and presentation shapes
- circuit-friendly selective disclosure and predicate verification

## Current model

The current iteration contains:

- shared Compact types for schema references and verification method identifiers
- a bounded `JubjubCredentialProof`
- one concrete credential schema: `BirthCredential`
- one concrete presentation schema: `BirthCredentialPresentation`
- helper circuits for:
  - VC body roots
  - VP body roots
  - issuer and holder proof binding
  - claim commitments
  - selective-disclosure checks for the birth-country claim
  - age-predicate verification against a committed birth date
- an executable demo business flow in
  [`../credentials-demo-contract/README.md`](../credentials-demo-contract/README.md)

## Why `BirthCredential` and not `AgeCredential`

The PoC used to model an age-oriented credential. That was the wrong abstraction.

The canonical credential should contain source claims that an issuer can actually attest to, such as:

- subject identifier commitment
- legal name commitment
- birth-date commitment
- birth-country commitment

`age >= threshold` is then a derived presentation-time predicate over the committed birth date.

This is more defensible for SSI because:

- the issuer attests to a real-world fact, not a moving computed attribute
- the holder can present different age thresholds over time without reissuance
- the verifier receives the minimum claim needed for the use case
- the Compact circuit remains aligned with selective disclosure and ZK proof design

## Data model

### Credential body

`BirthCredential` is the semantic issuer-signed body.

| Field | Purpose |
| --- | --- |
| `version` | schema version for the credential body |
| `credentialType` | fixed type discriminator |
| `schema` | Compact schema identity |
| `issuerVerificationMethodId` | Compact-native DID method reference for the issuer |
| `holderBinding` | required DID method reference for the holder |
| `issuedAt` / `expiresAt` | validity window |
| `claims` | per-claim commitments |
| `claimRoot` | root over the ordered commitment set |

### Claim commitments

The current `BirthCredential` does not carry raw claims in its public body. It carries commitments:

- `subjectIdCommitment`
- `legalNameCommitment`
- `birthDateCommitment`
- `birthCountryCodeCommitment`

Those commitments are anchored into `claimRoot` through `birthCredentialClaimRoot(...)`.

This gives the credential one stable commitment root while preserving circuit-friendly access to individual claim commitments.

### Presentation body

`BirthCredentialPresentation` is the semantic holder-authenticated body.

The current disclosure model supports:

- optional disclosure of the subject identifier commitment
- optional disclosure of the birth-country value together with its opening
- an age-over-threshold predicate request

Important detail: the birth-country disclosure includes both the padded value and the commitment opening. Without the opening, the verifier could not bind the disclosed value back to the committed claim.

### Proof model

The proof is separate from the VC or VP body.

`JubjubCredentialProof` contains:

- `purpose`
- `signerVerificationMethodId`
- `createdAt`
- `challengeHash`
- `publicKey`
- `signature`

The verifier derives the Jubjub signing challenge in-circuit from:

1. the VC or VP body root
2. proof metadata (`purpose`, signer method id, `createdAt`, `challengeHash`)
3. the signer public key
4. the nonce point `r`

The proof does not store a redundant `signatureChallenge` field.

## SSI capabilities used in this PoC

| SSI capability | How the PoC uses it |
| --- | --- |
| Issuer authentication and authorization | issuer proof is bound to `issuerVerificationMethodId`; this is the DID `assertionMethod` equivalent for credential issuance |
| Holder authentication | presentation proof is bound to `holderBinding.holderVerificationMethodId`; this is the DID `authentication` equivalent for presentation submission |
| Holder binding | the credential is explicitly holder-bound from issuance time |
| Selective disclosure | presentation can disclose selected claim material instead of the full claim set |
| Privacy-preserving predicates | age is verified from the committed birth date without disclosing the birth date |
| Anti-replay | `challengeHash` binds issuance and presentation proofs to a concrete interaction |
| Schema-bound validation | credential and presentation validation use fixed Compact schema identifiers and bounded layouts |

## Design decisions

### No network identifier in the VC/VP core

The VC/VP core types do not carry network metadata.

Reasoning:

- the verification method already points to a Midnight DID contract address plus method index
- network selection is an integration concern for resolver and transport layers
- keeping network out of the canonical VC/VP core makes the schema smaller and less environment-specific

### Holder binding is required

`BirthCredential` requires `holderBinding`.

Reasoning:

- it makes issuance semantics explicit from day one
- it avoids mixing bearer-style and holder-bound semantics in the first model
- it gives the presentation flow a clear expected authenticator

### No constructor and no business ledger in this package

This package is a shared schema and validation package, not an issuing business contract.

Reasoning:

- all SSI participants should be able to include and reuse these type definitions
- issuance, trust policy, and registries belong in higher-level contracts or services
- keeping this package pure makes it easier to reuse and test

That split is exercised by the demo contract package:

- [`src/credentials.compact`](src/credentials.compact) contains shared types and pure circuits
- [`../credentials-demo-contract/src/demo.compact`](../credentials-demo-contract/src/demo.compact) contains the executable issuer, holder, and verifier flow

## Standards alignment

The detailed standards review lives in
[`../research/midnight-vc-vp-frd-adr.md`](../research/midnight-vc-vp-frd-adr.md).

At a high level, the current PoC is aligned with the general direction of DID Core, VC Data Integrity, and VCDM 2.0 in these areas:

- issuer proofs and holder proofs use distinct purposes
- DID verification methods are central to proof verification
- verifier challenge binding is explicit
- selective disclosure is supported
- the holder can prove a predicate over a hidden source claim

The main deliberate deviations are:

- the canonical representation is Compact-native, not JSON-LD or JWT-native
- the model currently has no revocation/status mechanism
- the proof model has `challengeHash` but no explicit `domain` binding yet

## Executable flow

The current PoC implements this shape:

1. Issuer prepares a `BirthCredential` with committed claims.
2. Issuer signs the credential body plus issuance challenge through `JubjubCredentialProof`.
3. Demo contract records the issued credential root and the expected holder binding.
4. Holder prepares a `BirthCredentialPresentation` with an age threshold and optional disclosures.
5. Holder signs the presentation body plus verifier challenge.
6. Demo contract verifies:
   - credential proof is bound to the credential body
   - presentation proof is bound to the presentation body
   - issued credential root exists on-ledger
   - disclosed birth-country data matches the committed claim when disclosure is requested
   - holder witness matches the committed birth-date claim
   - `age >= threshold` without disclosing the birth date

## Build

- Compile Compact artifacts: `npm run contract -w credentials`
- Build TS exports: `npm run build -w credentials`
- Run tests: `npm test -w credentials`
- Type-check: `npm run typecheck -w credentials`

## Notes

- The package is a design probe. It is meant to expose where the VC/VP model must become more concrete to work in Compact.
- TypeScript in this package is generated around Compact artifacts, not the other way around.
