# Midnight DID Glossary

This glossary defines terms used by the Midnight DID workstream. It extracts
the durable terminology from the early draft documents in this branch and
aligns it with the current `develop` implementation model: ledger-backed
Midnight DID smart contracts, W3C DID Documents, opaque JWK key material,
native SchnorrJubjub keys, resolver output, and trusted proving assumptions.

The definitions are intentionally implementation-oriented. They should help
engineers, specification authors, integrators, and reviewers use the same
language when discussing the DID method, Compact circuits, TypeScript packages,
resolver behavior, privacy, and identity-verification use cases.

Every term has an explicit stable anchor so future specifications, docs, and
issues can link directly to the intended definition. Use the lowercase
kebab-case anchor shown by the heading, for example
`glossary.md#trusted-proof-server-model`.

## Core DID Terms

<a id="decentralized-identifier-did"></a>

### Decentralized Identifier (DID)

A globally unique identifier controlled by a DID subject rather than by a
central issuer. A Midnight DID uses the `did:midnight` method and resolves to a
W3C DID Document.

<a id="midnight-did"></a>

### Midnight DID

A DID using the Midnight DID method. Current Midnight DID work supports
ledger-backed DIDs whose method-specific identifier points to a Midnight smart
contract address and offchain DIDs whose method-specific identifier carries or
references encoded offchain DID state.

<a id="ledger-backed-midnight-did"></a>

### Ledger-backed Midnight DID

A `did:midnight` identifier whose state is stored in a Midnight smart contract.
The contract public state is the source of truth for DID Document
reconstruction. Mutating operations require controller authorization.

<a id="offchain-midnight-did"></a>

### Offchain Midnight DID

A `did:midnight:offchain` identifier whose state is not published to the
Midnight ledger. The long form carries encoded state; the short form carries
only the persistent hash of that state and therefore requires the encoded state
from local storage or resolver input metadata.

<a id="did-subject"></a>

### DID Subject

The entity identified by the DID. In the current Midnight DID model, resolved
`id`, `controller`, and verification method `controller` values identify the
same DID subject.

<a id="did-document"></a>

### DID Document

A W3C DID Core data structure describing the DID subject. For Midnight DID, the
resolver reconstructs the DID Document from ledger or offchain state and emits
keys, verification relationships, services, aliases, and method metadata.

<a id="did-document-metadata"></a>

### DID Document Metadata

Metadata about the DID Document and its state, such as `created`, `updated`,
`deactivated`, and `versionId`. In the current ledger-backed implementation,
timestamps are controller/prover-supplied metadata and must not be treated as
consensus-time attestations without an additional time source.

<a id="did-url"></a>

### DID URL

A DID plus optional path, query, or fragment. Midnight DID uses DID URL
fragments such as `#key-1` for verification method and service identifiers.
The SDK stores normalized fragment identifiers in ledger state, and resolvers
emit canonical absolute DID URLs in the DID Document.

<a id="method-specific-identifier"></a>

### Method-specific Identifier

The part of a DID after `did:midnight:`. For ledger-backed DIDs, this includes
the network segment and contract address. For offchain DIDs, it includes the
persistent hash of encoded state and may include the encoded state itself.

<a id="did-method-specification"></a>

### DID Method Specification

The normative document that defines the syntax, data model, operations,
security considerations, privacy considerations, and conformance rules for
`did:midnight`.

## Midnight Ledger And Resolution Terms

<a id="midnight-ledger"></a>

### Midnight Ledger

The public ledger infrastructure that stores Midnight smart-contract state.
For ledger-backed Midnight DIDs, the DID Document is reconstructed from the
contract public state available through ledger and indexer APIs.

<a id="did-contract"></a>

### DID Contract

The Compact smart contract that stores a ledger-backed Midnight DID state and
enforces DID state-transition rules such as controller authorization,
identifier uniqueness, relation membership, service mutation, and
deactivation.

<a id="ledger-state"></a>

### Ledger State

The public state exported by the DID contract. Important fields include the
DID identifier, controller public key, activity flags, timestamps, version,
verification method maps, relation sets, aliases, and services.

<a id="resolver"></a>

### Resolver

Software that takes a DID or DID URL, reads the relevant ledger or offchain
state, validates the state, and returns a DID resolution result containing a
DID Document, DID Document metadata, and DID resolution metadata.

<a id="indexer"></a>

### Indexer

Infrastructure that exposes Midnight ledger state to clients and resolvers.
In the current implementation, resolver and API flows rely on Midnight indexer
endpoints to find and read contract state.

<a id="network-segment"></a>

### Network Segment

The Midnight network name embedded in a ledger-backed DID, such as `undeployed`,
`devnet`, `testnet`, `preview`, `preprod`, or `mainnet`. The segment tells the
resolver which Midnight environment to query.

<a id="discoverability"></a>

### Discoverability

The ability to find and reconstruct DID state. Ledger-backed DIDs are
discoverable through the relevant Midnight ledger and indexer infrastructure.
Offchain DID short forms are not self-resolving without the encoded state.

## Controller And Proving Terms

<a id="controller"></a>

### Controller

The party authorized to mutate the DID state. The current Midnight DID model
uses a single controller whose controller value is equal to the DID subject in
the resolved DID Document.

<a id="local-secret-key"></a>

### localSecretKey

A wallet-held 32-byte secret used as a private Compact witness for
controller-gated operations. The ledger, indexer, resolver, and DID Document
readers do not see this secret, but a delegated proof server may see it.

<a id="controller-public-key"></a>

### controllerPublicKey

The on-ledger controller commitment derived from `localSecretKey` with a
domain-separated persistent hash. Update circuits recompute the value from the
witness and compare it with the stored `controllerPublicKey`.

<a id="controller-rotation"></a>

### Controller Rotation

The operation that replaces the stored `controllerPublicKey`. The current
design passes only the next locally derived controller public key to the
circuit; the replacement secret is generated and stored by the wallet.

<a id="proof-server"></a>

### Proof Server

Infrastructure that generates zero-knowledge proofs for Compact circuit
execution. A proof server may be local to the wallet or delegated to remote
infrastructure.

<a id="trusted-proof-server-model"></a>

### Trusted Proof Server Model

The current controller authorization assumption for Midnight DID. Because
controller-gated circuits use `localSecretKey` as a private witness, any proof
server that receives that witness must be trusted with controller authority for
the DID.

<a id="untrusted-prover-design"></a>

### Untrusted Prover Design

A future authorization model in which the wallet signs the exact operation
intent locally and the circuit verifies that signature. The proof server would
receive public signature material instead of the controller secret.

<a id="operation-intent"></a>

### Operation Intent

The complete data that a wallet authorizes for an update, such as operation
type, DID or contract identifier, current version or nonce, and all operation
inputs. Binding authorization to operation intent prevents proof-server input
manipulation.

## Key And Verification Terms

<a id="verification-method"></a>

### Verification Method

A public key entry in a DID Document. Midnight DID verification methods have an
identifier, type, controller, and key material. Relation sets refer to
verification method identifiers.

<a id="verification-relationship"></a>

### Verification Relationship

A DID Core property that states how a verification method may be used. Current
Midnight DID supports `authentication`, `assertionMethod`, `keyAgreement`,
`capabilityInvocation`, and `capabilityDelegation`.

<a id="authentication"></a>

### Authentication

The verification relationship used to authenticate the DID subject, for example
in login, challenge-response, or account-binding flows.

<a id="assertion-method"></a>

### Assertion Method

The verification relationship used when the DID subject expresses claims, such
as signing Verifiable Credentials.

<a id="key-agreement"></a>

### Key Agreement

The verification relationship used to establish encryption material for
confidential communication with the DID subject.

<a id="capability-invocation"></a>

### Capability Invocation

The verification relationship used to invoke a cryptographic capability, such
as authorizing an action against an API or protected resource.

<a id="capability-delegation"></a>

### Capability Delegation

The verification relationship used to delegate cryptographic authority to
another party or subordinate capability.

<a id="public-key-jwk"></a>

### publicKeyJwk

The W3C DID Document key property that carries JSON Web Key material. Midnight
DID uses `publicKeyJwk` for interoperability with DID Core and common SSI
tooling.

<a id="opaque-jwk-verification-method"></a>

### Opaque JWK Verification Method

A verification method whose JWK coordinates are stored on ledger as canonical
opaque strings. This path is used for Ed25519, X25519, P-256, and secp256k1.
The contract validates the supported key profile but does not parse arbitrary
JWK coordinates into native cryptographic values.

<a id="canonical-base64url"></a>

### Canonical Base64url

Unpadded base64url text using the RFC 4648 URL-safe alphabet. Midnight DID JWK
coordinates are expected to be canonical base64url values that decode to the
required byte length.

<a id="schnorr-jubjub-verification-method"></a>

### SchnorrJubjub Verification Method

A Midnight-native verification method using Schnorr over Jubjub. It is stored
as a native `JubjubPoint` on ledger and projected by the resolver into a DID
Document `publicKeyJwk` entry with `crv = "Jubjub"`.

<a id="jubjub-point"></a>

### JubjubPoint

A native Compact representation of a Jubjub public key point with field
coordinates. It is the canonical on-ledger representation for Midnight-native
SchnorrJubjub verification methods.

<a id="two-map-key-model"></a>

### Two-map Key Model

The current Midnight DID key-storage model. Non-Jubjub JWK methods are stored
in `verificationMethods` as opaque canonical strings. SchnorrJubjub methods
are stored in `schnorrJubjubVerificationMethods` as native `JubjubPoint`
values. Resolvers merge both maps into one DID Document `verificationMethod`
array.

<a id="ledger-bound-verification"></a>

### Ledger-bound Verification

A verification flow that reads the public key by method identifier from current
ledger state rather than accepting a caller-supplied public key. The
SchnorrJubjub verification circuit is ledger-bound so the proof is tied to the
current DID state.

<a id="proof-of-control"></a>

### Proof of Control

Evidence that a party controls a private key, secret, wallet, account, or other
identifier. In DID flows this often means signing a challenge or successfully
authorizing a DID update.

## Operations And Mutation Terms

<a id="create"></a>

### Create

The operation that deploys or constructs initial DID state. For ledger-backed
DIDs, creation deploys the DID contract and initializes controller and document
state.

<a id="read"></a>

### Read

The operation that resolves a DID by reading ledger or offchain state and
projecting it into a DID Document and metadata.

<a id="update"></a>

### Update

Any controller-gated operation that mutates DID state, such as adding keys,
changing verification relationships, setting services, rotating the controller,
or deactivating the DID.

<a id="deactivate"></a>

### Deactivate

The operation that marks a DID as no longer active. In the current model,
deactivation is permanent: the public state remains readable, but further
updates are rejected.

<a id="map-mutation"></a>

### MapMutation

An explicit Compact mutation enum for map-backed state. The current DID
contract uses it to distinguish insert and update operations without exporting
separate circuits for every API helper.

<a id="set-mutation"></a>

### SetMutation

An explicit Compact mutation enum for set-backed state. The current DID
contract uses it to distinguish insert and remove operations for aliases and
verification relationships.

<a id="service"></a>

### Service

A DID Document entry that describes how to interact with the DID subject or a
related capability. A service has an `id`, `type`, and `serviceEndpoint`.

<a id="service-endpoint"></a>

### serviceEndpoint

The DID Core service field that points to an endpoint or endpoint descriptor.
It may be a string, object, or array depending on the service model. Midnight
DID stores it as a JSON string on ledger so resolvers can reconstruct the DID
Document representation.

<a id="also-known-as"></a>

### alsoKnownAs

A DID Document property containing alternative identifiers for the DID subject.
Midnight DID stores aliases as a set of opaque strings.

## Privacy, Compliance, And Identity Terms

<a id="personal-data"></a>

### Personal Data

Information that identifies or can be combined to identify a person. Midnight
DID should not put personal data on ledger. Personal data belongs in separate
credential, wallet, or application storage flows with appropriate consent and
retention controls.

<a id="kyc"></a>

### KYC

Know Your Customer. A regulated identity-verification process used to establish
who a customer is and whether the customer satisfies onboarding requirements.

<a id="aml"></a>

### AML

Anti-Money Laundering. Controls and monitoring intended to detect or prevent
money laundering, terrorist financing, fraud, sanctions violations, and related
financial crime.

<a id="verification-source"></a>

### Verification Source

The source used to verify an identity claim or account claim, such as a
government registry, document check provider, bank API, OAuth provider, or
blockchain proof-of-control challenge.

<a id="verification-method-compliance-context"></a>

### Verification Method (Compliance Context)

The procedure used to verify a claim in a KYC/AML or onboarding process, such
as document scanning, facial match, utility-bill check, SMS code, microdeposit,
OAuth token introspection, or signed-message verification. This is distinct
from a DID Core verification method, which is a public key entry.

<a id="verification-level"></a>

### Verification Level

The depth or confidence tier of an identity check, such as basic verification,
enhanced verification, or ongoing monitoring.

<a id="verification-timestamp"></a>

### Verification Timestamp

The time at which a claim, account, address, or identity attribute was verified
or last refreshed.

<a id="audit-trail"></a>

### Audit Trail

A record of who changed or accessed identity data, what was verified, how it
was verified, and when. Audit trails should be kept outside public DID state
unless the data is explicitly intended to be public.

<a id="separation-of-concerns"></a>

### Separation of Concerns

The practice of keeping public DID state, private key custody, personal data,
credential contents, resolver services, and compliance records in their proper
systems instead of overloading the DID Document.

<a id="traceability"></a>

### Traceability

The ability to correlate activity across contexts. Reusing the same DID,
service endpoint, key, or public credential reference across unrelated contexts
can increase traceability.

<a id="correlation"></a>

### Correlation

Linking multiple activities, presentations, transactions, or identifiers to the
same person or organization. DID and credential designs should minimize
unnecessary correlation.

<a id="misattribution"></a>

### Misattribution

Incorrectly attributing an action, key, credential, or account to the wrong
subject. Midnight DID reduces some forms of misattribution by binding updates
to controller authorization, but applications still need careful identity and
credential validation.

<a id="ongoing-monitoring"></a>

### Ongoing Monitoring

Periodic re-verification or screening of identity data, payment data, blockchain
addresses, or risk signals to keep compliance status current.

<a id="verifiable-credential"></a>

### Verifiable Credential

A tamper-evident claim set issued by an issuer about a subject. Midnight DID can
publish keys and service endpoints used by VC issuer, holder, and verifier
flows, but credential contents should not be embedded directly into the DID
Document.
