# Midnight DID use cases

## Purpose

This document collects SSI use cases that fit the Midnight DID method and its
current reference implementation. It also distinguishes between:

- what is already supported by the DID method and reference implementation,
- what can be built at the application layer on top of the current repo, and
- what needs additional smart contracts, circuits, or platform capabilities.

## Current building blocks in this repository

The current repository already gives a strong DID foundation:

- a W3C DID method and DID document model (`w3c-spec/`, `domain/`, `did/`)
- an on-chain DID smart contract (`contract/src/did.compact`)
- API and CLI flows to deploy, update, and resolve DIDs (`api/`, `cli/`)
- DID resolution infrastructure (`did-resolver-service/`)
- support for multiple verification methods and DID relationships
- support for `Ed25519`, `Jubjub`, and `P-256` JWK verification methods
- support for `authentication`, `assertionMethod`, `keyAgreement`,
  `capabilityInvocation`, and `capabilityDelegation`
- support for DID service endpoints used for discovery and integration

There are also important constraints that shape the use cases:

- the DID contract is single-controller today; native multi-controller DID
  governance is not supported
- DID updates are authorized by the contract controller witness, which is
  different from DID document keys used for authentication or VC signing
- the repo does not yet implement a VC data model, VC proof formats, trust
  registries, revocation registries, or selective-disclosure circuits
- smart-contract composability is not yet available in the way needed for a
  generic contract to resolve another DID on-chain

## Summary

| Use case | Fit with current repo | Notes |
| --- | --- | --- |
| Authentication with DID and WebAuthn | Strong foundation, app-layer work needed | DID key anchoring is ready; WebAuthn relying-party logic is outside this repo. |
| VC signing and verification | Strong foundation, app-layer work needed | `assertionMethod` works well; a compact-friendly VC profile still needs to be designed. |
| Multi-sig collaborative approvals | Requires companion contract or orchestration | Good SSI pattern, but not native to the DID contract because Midnight DID is single-controller. |
| DID registry for issuer/verifier discovery and governance | Requires new contract | Useful as a trust registry, not as a replacement for DID resolution itself. |
| ZKP age verification | Requires new contract and proof system work | Good long-term fit for Midnight, but depends on compact VC design and proof circuits. |
| Delegated agent authorization | Good near-term extension | Fits `capabilityDelegation` and service endpoints well. |
| DIDComm or secure agent discovery | Partial fit, profile work needed | DID services and `keyAgreement` are useful, but an interoperable messaging crypto profile still needs to be defined. |
| Regulated finance and RWA access control | Strong app-level fit | DID and VC can carry accreditation, KYC, and issuer-status claims without exposing full identity data. |
| Reusable KYC and compliance attestations | Strong app-level fit | Good for onboarding, marketplace access, and regulated service eligibility. |
| Healthcare and medical attestations | Strong app-level fit | Good for provider credentials, patient consent, and selective disclosure of medical facts. |
| Record provenance and compliance evidence | Strong app-level fit | Good for signed maintenance, audit, and legal/compliance attestations. |

## 1. Authentication with DID and WebAuthn

### Why it fits

This is one of the strongest near-term use cases. Midnight DID already supports
`P-256` verification methods, which aligns with the common `ES256` / passkey
ecosystem used by WebAuthn.

### How it can work

1. The wallet or user agent creates a WebAuthn credential backed by a `P-256`
   key pair.
2. The public key is published in the Midnight DID document as a
   `verificationMethod` linked through `authentication`.
3. The relying party resolves the DID through the resolver service and verifies
   the WebAuthn challenge response against the `P-256` JWK in the DID document.
4. The DID becomes the public trust anchor for passkey-based authentication.

### What the current repo already supports

- storage and resolution of `P-256` JWK verification methods
- explicit `authentication` relationship support
- CLI secret-storage support for `P-256` key generation, signing, and
  verification
- DID service endpoints that can later advertise WebAuthn-related endpoints or
  metadata

### What still needs to be added

- relying-party backend logic for WebAuthn registration and authentication
- attestation policy handling
- credential lifecycle APIs for passkey management
- account-linking logic between a WebAuthn account and the Midnight DID subject

### Recommendation

Treat this as an application-layer feature on top of the current DID stack.
Use `P-256` for WebAuthn authentication, and keep `Jubjub` for use cases that
need Midnight-native ZK compatibility.

## 2. Signing and verification of Verifiable Credentials

### Why it fits

Midnight DID already supports `assertionMethod`, which is the natural DID
relationship for issuers that sign Verifiable Credentials. This makes VC
issuance and verification a direct SSI use case for the method.

### How it can work

1. An issuer publishes an issuer key in its DID document under
   `assertionMethod`.
2. The issuer signs a credential for the holder using that key.
3. The verifier resolves the issuer DID, finds the active issuer key, and
   verifies the VC signature.
4. Service endpoints in the DID document can advertise issuer metadata,
   credential status endpoints, or schema references.

### Recommended compact-friendly VC profile

The first VC profile should be designed for Compact constraints rather than
starting from a large JSON-LD structure. A practical profile should:

- prefer fixed-size values, enums, hashes, and integers over long free-form
  strings
- encode dates as numeric values such as `epochDays` or `YYYYMMDD`
- keep large human-readable metadata off-chain and refer to it by hash or URI
- separate the human-readable VC envelope from the values that must be proven
  in a circuit
- use a deterministic canonical hash as the object that is signed or proven

### Suggested first credential families

- `MidnightCompactIdentityCredential`
  - minimal identity binding between issuer DID and holder DID
- `MidnightCompactRoleCredential`
  - role code, scope hash, validity interval
- `MidnightCompactAgeCredential`
  - birth-date or birth-date commitment, validity interval, issuer DID

### What the current repo already supports

- issuer key publication and rotation through `assertionMethod`
- DID resolution for issuer and verifier trust decisions
- off-chain signing helpers for `Ed25519`, `P-256`, and `Jubjub`
- service endpoints that can expose schemas, status APIs, or metadata

### What still needs to be added

- VC schema definitions
- credential proof format selection
- credential status or revocation model
- issuance and verification SDK flows
- canonical hashing rules for compact-friendly credential payloads

## 3. Multi-sig for collaborative voting and approvals

### Why it fits

Many SSI governance decisions are collaborative rather than single-signer:
issuer onboarding, policy changes, delegated trust approvals, DAO voting, or
joint approval for high-value actions.

### Important design reality

This is not a native feature of the current Midnight DID contract. The DID
method is single-controller, and the controller witness used to mutate DID
state is not a threshold-signature scheme.

### How it should be implemented

Use Midnight DID as the identity layer for the participants, and implement the
multi-sig logic in a companion governance contract or an approval service:

1. Each participant has its own Midnight DID.
2. Each participant signs approvals using a DID key published under
   `assertionMethod` or `capabilityInvocation`.
3. A separate multi-sig or governance component enforces threshold rules such as
   `2-of-3` or weighted voting.
4. Once threshold is met, the governed action is executed against a target
   system such as a registry contract, issuer policy contract, or off-chain
   approval workflow.

### Good target scenarios

- collaborative issuer onboarding
- verifier allow-list governance
- board or committee resolutions
- DAO-style authorization over SSI trust policies

### What the current repo already supports

- DID identities for all participants
- multiple verification methods per DID
- `capabilityInvocation` and `capabilityDelegation` relationships
- off-chain signature generation and verification for `Ed25519`, `P-256`, and
  `Jubjub`

### What still needs to be added

- a separate multi-sig or governance contract
- proposal, quorum, and threshold logic
- execution policies for governed actions

## 4. Midnight DID registry for issuer/verifier discovery and governance

### Why it fits

A DID registry is useful in SSI, but it should be understood as a trust
registry, not as the core DID resolution layer.

The DID itself already contains the Midnight contract address, so a separate
registry is not required to resolve a DID. The registry becomes valuable when
the ecosystem needs search, trust roles, accreditation, governance, or policy
metadata across many DIDs.

### Recommended registry purpose

The registry should answer questions such as:

- which DIDs are trusted issuers for a given domain?
- which DIDs are trusted verifiers?
- who assigned that role, under which governance process, and until when?
- which endpoints, schemas, or policies does an issuer or verifier publish?

### Recommended roles

- `governance-admin`
- `issuer`
- `verifier`
- `schema-authority`
- `status-provider`
- `auditor` or `accreditor`

### Recommended design

The registry should be a separate smart contract that stores:

- subject DID
- subject contract address or a normalized DID hash
- role code
- assigning DID or governance identifier
- validity interval
- status flag
- metadata hash or service reference hash

### How Midnight DID participates

- the DID document remains the canonical identity anchor
- DID service endpoints publish APIs and metadata for the registered entity
- a multi-sig governance pattern can govern role assignment and removal

### What the current repo already supports

- DID resolution and DID-document-based discovery primitives
- service endpoints for publishing issuer or verifier endpoints
- all identity keys needed to authenticate registry operations

### What still needs to be added

- the registry contract itself
- role data model and governance rules
- trust-list query APIs and UX

## 5. ZKP age verification

### Why it fits

This is a strong long-term Midnight use case because it combines SSI with
privacy-preserving smart contracts: the holder proves "I am over age X" without
revealing the full birth date to the application.

### How it can work

1. A trusted issuer signs an age-related credential for the holder.
2. The holder stores the credential off-chain.
3. The holder generates a proof that:
   - the credential was issued by a trusted issuer DID,
   - the credential is valid,
   - the age threshold is satisfied.
4. The application contract, such as an auction contract, verifies the proof and
   accepts or rejects access.

### Recommended credential shape

The first version should be compact-friendly:

- issuer DID
- holder DID
- birth-date as `epochDays` or a birth-date commitment
- validity interval
- credential schema hash
- credential status reference

In many cases, the circuit should operate over a commitment or Merkle leaf
rather than over a large raw VC document.

### What still blocks a full implementation today

- a compact-friendly age credential profile
- trusted issuer registry or allow-list
- revocation or status checking model
- proof circuits for signature validation and age comparison
- contract integration for proof verification
- platform support for the composability needed to pull DID state into other
  contracts in a general way

### Practical near-term variant

Before full on-chain verification is available, an oracle or relayer service can
verify the credential and submit a simpler yes/no attestation to the target
contract. That is less trust-minimized than a full ZKP flow, but it is a
realistic intermediate step.

## 6. Delegated agent authorization

### Why it fits

Institutions often want one DID to represent the legal entity, while delegated
agents or microservices act on its behalf for issuance, verification, status
management, or customer support workflows.

### How it can work

- the root organizational DID publishes one or more operational keys
- those keys are linked through `capabilityDelegation` or
  `capabilityInvocation`
- service endpoints point to the agent APIs that act for the organization

### Good target scenarios

- enterprise issuer agent
- verifier gateway service
- revocation or status service operator
- WebAuthn account-management service

### Value

This gives a cleaner SSI separation between legal identity, operational keys,
and service endpoints without creating a new DID for every backend component.

## 7. DIDComm or secure agent discovery

### Why it fits

Credential exchange and presentation exchange typically need endpoint discovery
plus key-agreement material. Midnight DID already supports service endpoints and
`keyAgreement`, which makes this a reasonable interoperability direction.

### How it can work

- publish DIDComm-style service endpoints in the DID document
- publish key-agreement keys under `keyAgreement`
- let wallets, issuers, and verifiers resolve the DID and discover how to reach
  the corresponding agent

### What still needs to be added

- the actual DIDComm or messaging stack
- mediation, routing, and transport policies
- an agreed cryptographic profile for interoperable key agreement
- interoperability profiles with external SSI ecosystems

## 8. Regulated finance and RWA access control

### Why it fits

Many dApps in the Midnight ecosystem need to distinguish between:

- who a user is,
- what role they have,
- whether they are eligible for a regulated action,
- and which facts can remain private.

That is a classic DID-plus-VC problem.

### How it can work

1. The user controls a Midnight DID.
2. A trusted issuer publishes compliance or accreditation credentials for that
   DID.
3. The user presents either the credential itself or a derived proof to a
   financial dApp.
4. The dApp checks the issuer DID, trust registry status, and claim validity
   before allowing access.

### Good target scenarios

- accredited-investor access for RWA trading
- eligibility gating for tokenization platforms
- KYC-gated escrow or marketplace participation
- private allow-listing for auctions or OTC flows

### Example inspiration from `midnight-awesome-dapps`

- `Real World Assets`
- `Asset Tokenization Platform`
- `dMarket`
- `Midnauction`
- `Midnight Bank`
- `Tokenless`

## 9. Reusable KYC and compliance attestations

### Why it fits

KYC is one of the most obvious SSI use cases. Instead of re-running the same
checks for each application, a trusted issuer can issue a reusable compliance
credential bound to a Midnight DID.

### How it can work

- an issuer performs KYC, KYB, sanctions, or jurisdiction checks off-chain
- the issuer signs a compact compliance credential
- the holder reuses that credential across multiple Midnight dApps
- verifiers check the issuer DID, trust status, validity interval, and claim
  scope

### Suggested claim families

- person verified
- organization verified
- residency or jurisdiction class
- accredited or non-accredited status
- sanctions-screened at timestamp T
- privacy-score or compliance-score attestation

### Example inspiration from `midnight-awesome-dapps`

- `KYC Midnight`
- `Blockenfy`
- `DPO2U Midnight`
- `Midnight Cloak`

## 10. Healthcare and medical attestations

### Why it fits

Healthcare needs strong identity, role-based trust, and selective disclosure.
Midnight DID can anchor the identities of patients, clinics, doctors, labs, and
insurers, while VCs can carry medical or professional attestations.

### How it can work

- provider DIDs receive role credentials from an accrediting authority
- patients receive credentials or attestations about records, eligibility, or
  coverage
- a verifier receives only the minimum facts needed, ideally via selective
  disclosure or a ZK proof

### Good target scenarios

- doctor or clinic accreditation
- proof that a test result exists without disclosing the full record
- eligibility for treatment, reimbursement, or grants
- patient consent or authorization receipts

### Example inspiration from `midnight-awesome-dapps`

- `Medical Verification System`
- `NextMed`

## 11. Record provenance and compliance evidence

### Why it fits

Some Midnight dApps do not need a full identity wallet experience, but they do
need tamper-evident records signed by accountable actors. DID and VC patterns
fit well here because they answer:

- who signed this record,
- under what role,
- with what authority,
- and whether the verifier should trust that signer.

### How it can work

- an organization or professional publishes a Midnight DID
- authorized agents sign attestations, logs, or compliance statements
- verifiers resolve the signer DID and validate the record signature
- privacy-sensitive fields stay off-chain, while hashes, proofs, or status
  references are anchored on Midnight

### Good target scenarios

- aviation maintenance attestations
- legal discovery or case-handling attestations
- privacy or GDPR/LGPD compliance statements
- audit evidence for regulated workflows

### Example inspiration from `midnight-awesome-dapps`

- `AirLog`
- `AutoDiscovery`
- `DPO2U Midnight`

## Recommended implementation sequence

If the goal is to deliver value incrementally, the best order is:

1. DID authentication with WebAuthn
2. VC signing and verification with a compact-friendly credential profile
3. reusable KYC/compliance credentials
4. issuer/verifier trust registry
5. multi-sig governance for the registry
6. regulated finance and RWA access control
7. healthcare and provenance attestations
8. ZKP age verification

This order starts from the capabilities that are already closest to the current
reference implementation and postpones the features that need new contracts or
advanced ZK work.

## External inspiration

The additional domain examples in sections 8 to 11 were derived from the
curated Midnight ecosystem repository:

- [midnight-awesome-dapps](https://github.com/midnightntwrk/midnight-awesome-dapps)

The most relevant categories for Midnight DID and VC planning are:

- `Identity & Privacy`
- `Finance & DeFi`
- `Governance`
- `Healthcare`
