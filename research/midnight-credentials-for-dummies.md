# Midnight Credentials For Dummies

Version: `0.1-draft`

This document is the friendly companion to `research/midnight-credentials.md`.

The specification is still the source of truth.
This guide is the comic-book director's cut:

- more story
- more plain-language explanations
- more pointers to the actual Compact circuits
- more clarity about how the Midnight stack changes the SSI mental model

If the specification feels dense, start here.

![The cast of the Midnight Credentials story](./assets/midnight-credentials-cast.svg)

## Who This Is For

This document is for people who:

- understand DIDs and VCs only a little
- understand Midnight only a little
- want to know what the current code is doing
- want to learn one capability at a time instead of decoding the full spec first

If the specification feels like it was written by three auditors and one sleep-deprived cryptographer, this document is your safer entry point.

## How To Read This

Read it like a story:

1. start with the simplest credential
2. see what problem appears next
3. watch Mohawk become professionally dissatisfied
4. see which capability fixes the problem
5. jump to the linked tests and circuits when you want the exact mechanics

## Cast Of Characters

We reuse the same people across chapters.

| Character | Role | What they want | What goes wrong for them |
| --- | --- | --- | --- |
| Alice | holder | prove what matters without oversharing | people keep asking for more than they need |
| Bob | another holder | sometimes honest, sometimes the counter-example | accidentally helps us discover edge cases |
| Rita | issuer | attest source facts accurately | does not want the issuance model to become nonsense |
| Vera | verifier | accept only valid proofs for this request | would also like fewer support tickets |
| Mohawk | engineer | keep privacy and composability sane | notices every leak, replay path, and awkward abstraction |

## The World Rules

Before the story starts, remember three Midnight-specific rules.

### Rule 1: Smart contracts are passive

Contracts do not wake Alice up.
They do not send messages.
They do not open sessions.
They expose state and circuits.

So if a verifier contract has a request, that request is:

- read by an application
- derived by an application
- or reconstructed by the caller before submission

The contract does not shout across the network like a haunted Slack bot.

### Rule 2: Witnesses live off-chain

The private material used to satisfy the proof lives with the holder.

That means:

- witness preparation is local
- disclosure decisions are local
- predicate proofs are local
- the application layer matters a lot

### Rule 3: Midnight verification is split across layers

The stack is not "everything happens in the contract".

The real flow is:

1. an app or wallet orchestrates the protocol
2. the holder prepares witnesses and proofs locally
3. the contract verifies submitted evidence and performs business logic

If you remember only one architectural sentence, remember this:

- protocols are off-chain
- verification semantics are on-chain

## One-Screen Summary

Midnight Credentials in the current prototype are built in five layers.

| Layer | Purpose | Current packages or status |
| --- | --- | --- |
| Layer 1 | reusable generic credential capabilities | `credentials`, `credentials-same-holder` |
| Layer 2 | concrete credential-family logic | `credentials-birth`, `credentials-birth-secret` |
| Layer 3 | business smart-contract behavior | `credentials-demo-contract` |
| Layer 4 | application orchestration outside Compact | `credentials-protocol` |
| Layer 5 | governance and trust policy | abstract future scope for now |

Think of it this way:

- Layer 1 gives you reusable Lego bricks.
- Layer 2 builds one specific credential family.
- Layer 3 uses those credentials to decide whether the contract should do something useful.
- Layer 4 coordinates the real protocol between apps, wallets, and contracts.
- Layer 5 decides which issuers, verifiers, schemas, and policies the ecosystem should trust.

### Why Layer 5 Exists But Stays Abstract

Governance is real.
The moment a system asks:

- which issuer is trusted
- which verifier is authorized
- which VC types are supported
- which schema versions are accepted

you are already in governance territory.

But that is not the same thing as the VC core.

So in the current work:

- Layer 5 is acknowledged
- Layer 5 is not yet implemented as a package
- Layer 5 must not pollute the core VC design while the cryptographic and protocol model is still stabilizing

## Quick Package Map

| Package | What it does in simple words |
| --- | --- |
| `credentials` | the generic VC/VP envelope, proof logic, and holder-binding primitives |
| `credentials-same-holder` | optional proof that two hidden-holder presentations came from the same holder |
| `credentials-birth` | a birth credential family using explicit DID-based holder binding |
| `credentials-birth-secret` | the same birth family, but with hidden holder binding and better privacy |
| `credentials-demo-contract` | a verifier-like business contract that turns successful proof into reusable access capability |
| `credentials-protocol` | party-boundary simulation layer with IssuerAgent, HolderAgent, VerifierAgent, and a MessageBus transport seam |
| `standalone-environment` | shared Docker environment for integration tests — provisions real Midnight DIDs for issuer, holder, and verifier |

## Chapter 1: Rita Issues A Very Boring, Very Important Credential

Rita works in an imaginary office where every drawer has a policy and every policy has a form.

Alice shows up and needs a credential that says:

- Alice has a subject ID
- Alice has a legal name
- Alice has a birth date
- Alice has a birth country

Rita does not issue "age over 18" directly.
That would be too narrow and too brittle.
Instead she attests to source facts.

That is the first important design choice:

- credential = source facts
- later proof = derived facts

### Why The Credential Body Uses Commitments

The credential body is not a pile of raw personal data.
It is mostly commitments to personal data.

That gives us these benefits:

- the structure is strongly typed for Compact
- the verifier can check integrity without seeing every value
- later predicates can be proven from committed values

### Conceptual Diagram

```mermaid
flowchart LR
  Rita[Issuer Rita] --> Claims[Source claims]
  Claims --> Commitments[Commitments]
  Commitments --> VC[Typed credential body]
  VC --> Proof[Issuer proof]
  Proof --> Alice[Alice stores credential]
```

### What The Circuits Are Actually Doing

In code, this chapter is mostly about these circuits:

- `credentials-birth/src/birth-credential.compact`
  - `birthCredentialClaimRoot(...)`
  - `subjectIdCommitment(...)`
  - `legalNameCommitment(...)`
  - `birthDateCommitment(...)`
  - `birthCountryCodeCommitment(...)`
- `credentials/src/credentials.compact`
  - `VC<...>.assertValidCredentialEnvelope(...)`
  - `VC<...>.assertValidCredentialProof(...)`
- `credentials-birth/src/birth-credential.compact`
  - `assertValidBirthCredential(...)`

The claim commitment circuits (`subjectIdCommitment`, `birthDateCommitment`, etc.) live in a shared module `credentials-birth/src/birth-credential/claims.compact` that is imported by both the explicit-holder and secret-holder credential families. That avoids duplicating the commitment logic across packages.

### In Plain Words

- the claim commitment circuits turn concrete values plus openings into fixed commitments
- `birthCredentialClaimRoot(...)` hashes the ordered commitment set into one stable root
- `assertValidCredentialEnvelope(...)` checks generic credential invariants such as version and claim-root consistency
- `assertValidCredentialProof(...)` makes sure the issuer proof really belongs to the issuer method recorded in the credential
- `assertValidBirthCredential(...)` glues the generic checks to the birth schema

### Why This Matters

By the end of this chapter, Alice has something useful.
But she does not yet have something reusable.

She has a credential body and an issuer proof.
She does not yet have a presentation for a verifier.

### Tests For This Chapter

- `credentials-birth/src/test/capability-profiles.test.ts`
  - "supports the simplest issuer-attested source claim flow"
- `credentials-birth/src/test/holder-binding.test.ts`
  - "binds the issuer proof to the credential body"

## Chapter 2: Why A Presentation Exists

Alice now wants to use the credential.
Vera does not just want a static file dropped on her desk like an expired conference badge.

She wants proof that:

- the credential is real
- the holder is the right holder
- the proof is for this verifier interaction, not a replay from Tuesday

So we add a presentation.

### The Main Idea

A credential says:

- "Rita attested these claims"

A presentation says:

- "Alice is using this credential now, for this request, under this verifier challenge"

### Why The Challenge Exists

Without a verifier challenge, a presentation can be replayed.

With a verifier challenge:

- the holder proof becomes session-bound
- old presentations become less useful
- the verifier can state exactly what interaction this proof belongs to

### Sequence

```mermaid
sequenceDiagram
    participant Rita as Rita (Issuer App)
    participant Alice as Alice (Holder App)
    participant Core as VC core circuits

    Rita->>Alice: Issue typed credential + issuer proof
    Alice->>Alice: Build presentation body locally
    Alice->>Core: derive presentationProofChallenge(...)
    Core-->>Alice: context-bound challenge
    Alice->>Alice: Create holder proof over presentation body
    Alice->>Alice: Send presentation package to verifier app or contract caller
```

### What The Circuits Are Actually Doing

In the generic core:

- `verifySignature(...)`
- `issuanceContextTag(...)`
- `presentationContextTag(...)`
- `issuanceProofChallenge(...)`
- `presentationProofChallenge(...)`
- `assertValidIssuanceContextProof(...)`
- `assertValidPresentationContextProof(...)`

### In Plain Words

- `Proof` is reused for both issuance and presentation
- the system does not store a `purpose` field anymore
- instead, the context is separated by dedicated challenge derivation

That means:

- issuance proof uses issuance context
- presentation proof uses presentation context
- the same proof shape can be reused safely without pretending those contexts are identical

Mohawk approves of this because it is shorter, cleaner, and harder to misuse by accident.
Mohawk rarely approves of anything before coffee.

### Tests For This Chapter

- `credentials/src/test/proof-context.test.ts`
- `credentials-birth/src/test/holder-binding.test.ts`
  - "enforces a verifier-defined presentation request"

## Chapter 3: Explicit Holder Binding

The easiest holder model is:

- the credential is issued to Alice's DID verification method
- the presentation must be signed by that same method

This is simple.
Operationally, it is very good.
Privacy-wise, it is merely "fine, until it is not".

### Why This Model Is Good

- easy to explain
- easy to debug
- easy to integrate
- easy to map to DID thinking

### Why Mohawk Starts Squinting At It

If Alice keeps presenting the same holder method to many verifiers, those verifiers can correlate her.

The cryptography is not broken.
The privacy posture is just not ambitious enough.

### Diagram

```mermaid
flowchart TD
  VC[Credential] --> HolderMethod[Holder DID method]
  VP[Presentation] --> SameMethod[Same DID method]
  Proof[Presentation proof] --> SameMethod
  SameMethod --> Verify[Verifier checks they match]
```

### What The Circuits Are Actually Doing

In the generic core:

- `assertValidExplicitHolderBinding(...)`
- `assertMatchingExplicitHolderBindings(...)`
- `assertProofMatchesExplicitHolderBinding(...)`

In the birth specialization:

- `assertValidBirthCredentialPresentation(...)`

### In Plain Words

- the credential stores a holder DID method reference
- the presentation stores a holder DID method reference
- the presentation proof signer must match that same method

This is good engineering.
It is just not the end of the privacy story.

### Tests For This Chapter

- `credentials-birth/src/test/holder-binding.test.ts`
  - "binds the holder proof to the presentation body"
- `credentials-birth/src/test/capability-profiles.test.ts`
  - "supports an operational flow with explicit holder binding and selective disclosure"

## Chapter 4: Selective Disclosure And The Age Predicate

Now Vera says:

"I do not need Alice's full birth date. I need to know whether Alice is old enough."

This is where Midnight gets interesting.

Rita attests source facts.
Alice later proves a derived fact.

That is the pattern:

- credential = source claims
- presentation = selected disclosures + predicates

### Why This Matters

Without predicates:

- Alice reveals more than necessary

With predicates:

- Alice reveals less
- Vera still gets the answer she needs

### Sequence

```mermaid
sequenceDiagram
    participant Rita as Rita (Issuer App)
    participant Alice as Alice (Holder App)
    participant Birth as Birth credential circuits

    Rita->>Alice: Issue credential with birth-date commitment
    Alice->>Alice: Receive request requiring age >= 18
    Alice->>Alice: Prepare birth-date witness locally
    Alice->>Birth: build presentation disclosures
    Birth-->>Alice: presentation structure ready
    Alice->>Birth: satisfy age predicate with witness
    Birth-->>Alice: proof inputs ready for verifier contract
```

### What The Circuits Are Actually Doing

In `credentials-birth/src/birth-credential.compact`:

- `assertValidBirthCredentialPresentationRequest(...)`
- `assertBirthPresentationSatisfiesRequest(...)`
- `assertValidBirthCredentialAgePredicate(...)`

### In Plain Words

- the request says what the verifier wants
- the presentation says what Alice is willing to disclose or prove
- `assertBirthPresentationSatisfiesRequest(...)` checks that the presentation really satisfies the request
- `assertValidBirthCredentialAgePredicate(...)` checks the hidden birth-date witness against the committed birth-date claim and verifies the threshold condition

That last part is the magical-looking bit.
It is also the important bit.

The verifier does not need to know the raw birth date if the contract can still validate:

- the witness matches the commitment
- the witness implies the predicate

### Tests For This Chapter

- `credentials-birth/src/test/age-predicate.test.ts`
- `credentials-birth/src/test/capability-profiles.test.ts`
  - "supports a stronger flow with explicit holder binding, selective disclosure, and age predicate"

## Chapter 5: Alice Notices Someone Is Following Her

At first, everything seems fine.

Then Alice uses the same holder identifier with two verifiers.
Then three.
Then five.

Then she gets that uncomfortable feeling that somewhere, a spreadsheet has been opened in her honor.

She goes to Mohawk and says:

"I think they are tracking me."

Mohawk sighs the sigh of a person who has seen the same problem in six ecosystems and one procurement process.

"Yes," he says. "They probably are."

![Alice realizes the privacy problem and Mohawk has opinions](./assets/midnight-privacy-drama.svg)

### The Problem

Even if the credential and proofs are valid:

- a stable public holder method is still a correlation handle

Nothing catastrophic has happened.
But the system is not giving Alice pairwise privacy.

And Alice would strongly prefer not to become a recurring row in Vera's analytics export.

So Mohawk proposes a new direction:

- hidden holder binding

## Chapter 6: Hidden Holder Binding

Instead of saying:

- "this credential belongs to DID method X"

we say:

- "this credential belongs to whoever knows the hidden holder secret committed here"

### Why This Helps

The verifier no longer needs a stable public DID method to confirm holder control.

That means:

- less direct correlation
- stronger privacy baseline
- more room for pairwise presentation behavior later

### Diagram

```mermaid
flowchart TD
  Secret[Hidden holder secret] --> Commitment[Secret commitment]
  Commitment --> VC[Credential holder binding]
  Secret --> Response[Challenge response]
  Response --> VP[Presentation holder binding]
  VC --> Match[Verifier checks commitment lineage]
  VP --> Match
```

### What The Circuits Are Actually Doing

In `credentials/src/credentials.compact`:

- `secretHolderBindingCommitment(...)`
- `secretHolderBindingChallengeResponse(...)`
- `assertValidSecretHolderCredentialBinding(...)`
- `assertValidSecretHolderPresentationBinding(...)`
- `assertMatchingSecretHolderBindings(...)`
- `assertSecretHolderBindingWitness(...)`

### In Plain Words

- the credential stores a commitment to the holder secret
- the presentation stores a challenge response derived from that secret
- the verifier checks that the presentation binding matches the credential binding
- the holder supplies the secret and opening as private witness material
- the circuit proves the holder really knows the secret without publishing it
- the challenge response uses a dedicated domain separator (`"midnight:vc:holder-chall"`) to prevent cross-context hash collisions — consistent with how `verifierScopedPseudonym` and `blindedSecretHolderCommitment` use their own domain tags

That is the important privacy jump.

The holder is still bound.
The binding is just no longer a giant glowing label saying "hello, I am Alice again".

### Where This Shows Up In The Concrete Family

In `credentials-birth-secret/src/secret-birth-credential.compact`:

- `assertValidSecretBirthCredential(...)`
- `assertValidSecretBirthCredentialPresentation(...)`
- `assertSecretBirthPresentationSatisfiesRequest(...)`

The secret-holder variant defines its own disclosure and request types — `SecretBirthCredentialDisclosures` and `SecretBirthCredentialPresentationRequest` — rather than reusing the explicit-holder types. This prevents accidental mixing of the two profiles.

### Tests For This Chapter

- `credentials/src/test/secret-holder-binding.test.ts`
- `credentials-birth-secret/src/test/holder-binding.test.ts`

## Chapter 7: Blinded Holder Binding

Mohawk is still not fully satisfied.

He says:

"Good. We hid the public DID method. Now let us talk about issuance-time exposure too."

This is where the model adds a blinded holder-binding anchor.

### What This Is

Start from:

- a hidden holder secret
- its commitment
- an issuer nonce
- a holder blinding factor

Then derive a safer issuance anchor.

### What This Is Not

It is not full blind issuance yet.
That distinction matters.

This is:

- a building block
- a privacy-oriented anchor
- a better place to continue from

This is not:

- a complete blind-signature issuance protocol
- a finished production privacy protocol

### What The Circuits Are Actually Doing

In `credentials/src/credentials.compact`:

- `blindedSecretHolderCommitment(...)`
- `assertValidBlindedSecretHolderCredentialBinding(...)`
- `assertValidBlindedSecretHolderPresentationBinding(...)`
- `assertMatchingBlindedSecretHolderBindings(...)`
- `assertBlindedSecretHolderBindingWitness(...)`

### In Plain Words

- the credential binding stores a blinded form of the secret commitment
- the presentation binding still proves the holder knows the underlying secret
- the same holder can later satisfy proofs without revealing the raw holder secret

This gives us a stronger privacy-oriented substrate for future work.

Mohawk calls it "a respectable intermediate state".
Which is the closest he gets to romance.

### Tests For This Chapter

- `credentials/src/test/secret-holder-binding.test.ts`
  - blinded holder-binding witness
- `credentials-birth-secret/src/test/capability-profiles.test.ts`
  - advanced privacy profile

## Chapter 8: Verifier-Scoped Pseudonym

Now Vera says:

"I do not need Alice's global identity. I just need to know whether this is the same returning user in my domain."

That is a legitimate product requirement.
It just needs to be handled carefully.

So we add a verifier-scoped pseudonym.

### The Main Idea

The pseudonym is derived from:

- the hidden holder secret
- a verifier-domain hash

That means:

- the pseudonym is stable for one verifier domain
- it does not need to be stable everywhere

### Why This Is Better Than Reusing A Global DID

Vera gets local continuity.
She does not get a universal tracking handle.

That is a much better tradeoff.

### What The Circuits Are Actually Doing

In `credentials/src/credentials.compact`:

- `verifierScopedPseudonym(...)`
- `assertVerifierScopedPseudonym(...)`

In `credentials-birth-secret/src/secret-birth-credential.compact`:

- request fields carrying verifier domain context
- pseudonym disclosure checks inside `assertSecretBirthPresentationSatisfiesRequest(...)`

### In Plain Words

- the verifier request can demand a verifier-scoped pseudonym
- the holder computes it from the hidden holder secret and verifier-domain hash
- the circuit checks the pseudonym is correct for that domain

This lets Vera say:

- "I know this is the same person for my service"

without being able to say:

- "and therefore I know this is the same person in everybody else's service too"

### Tests For This Chapter

- `credentials/src/test/secret-holder-binding.test.ts`
- `credentials-birth-secret/src/test/holder-binding.test.ts`
  - "derives a verifier-scoped pseudonym from the hidden holder secret"

## Chapter 9: Vera Wants Two Credentials, But One Holder

Now Vera asks for something harder.

She says:

"I need Alice to prove two different credentials belong to the same person."

Still fair.
Still useful.
Still dangerous if handled lazily.

Because the naive way to do this is:

- reveal the same public holder DID in both presentations

which puts us straight back into the "Alice is being tracked by a spreadsheet" problem.

So Mohawk looks offended again.
This is his default working posture.

## Chapter 10: The Same-Holder Capability

Instead of inventing one giant universal bundle format too early, the code uses a smaller and sharper capability:

- prove that two holder bindings are satisfied by the same hidden holder secret witness under one shared verifier challenge

That is enough.
And enough is often a better abstraction than "everything for all future use cases forever".

### Why This Design Is Good

It avoids freezing the wrong multi-credential presentation model too early.

Instead:

- each credential family keeps its own request and presentation types
- the verifier chooses when same-holder composition is required
- the capability package proves only the relation that matters

### Diagram

```mermaid
flowchart LR
  Secret[Same hidden holder secret]
  Secret --> Bind1[Credential A holder binding]
  Secret --> Bind2[Credential B holder binding]
  Challenge[Shared verifier challenge] --> Bind1
  Challenge --> Bind2
  Bind1 --> SameHolder[Same-holder capability]
  Bind2 --> SameHolder
  SameHolder --> Verify[Verifier accepts both belong to same holder]
```

### What The Circuits Are Actually Doing

In `credentials-same-holder/src/same-holder.compact`:

- `assertSameSecretHolderBindingWitnesses(...)`
- `assertSameBlindedSecretHolderBindingWitnesses(...)`

In `credentials-birth-secret/src/secret-birth-credential.compact`:

- `assertSameHolderSecretBirthPresentations(...)`

### In Plain Words

- each presentation is validated independently first
- both requests must share the same verifier challenge
- both holder bindings are then checked against the same hidden holder secret witness
- the concrete credential-family circuit composes those checks instead of pushing a universal bundle object into the generic core

That is very Midnight-friendly:

- small reusable capability at Layer 1
- family-specific composition at Layer 2

### Tests For This Chapter

- `credentials-same-holder/src/test/same-holder-capability.test.ts`
- `credentials-birth-secret/src/test/same-holder-composition.test.ts`

## Chapter 11: Capability Profiles, Or How Not To Lie To Yourself

At this point, the system has multiple privacy and presentation capabilities.

So the honest way to describe it is not:

- "the credential system does everything"

The honest way is:

- "the system supports a set of capability profiles"

That is a better engineering habit because it tells you exactly what combination you are using.

### Current Profiles

| Profile | What it means in simple words | Test |
| --- | --- | --- |
| simplest issuer-attested source claim | Rita attests to the typed birth credential and nothing fancy happens yet | `credentials-birth/src/test/capability-profiles.test.ts` |
| operational explicit-holder flow | Alice uses a DID-bound holder method and reveals only what Vera requests | `credentials-birth/src/test/capability-profiles.test.ts` |
| age-predicate flow | Alice proves `age >= threshold` instead of revealing the raw birth date | `credentials-birth/src/test/age-predicate.test.ts` |
| hidden-holder flow | Alice proves control using a hidden holder secret instead of a visible DID method | `credentials-birth-secret/src/test/capability-profiles.test.ts` |
| advanced privacy flow | Alice uses hidden holder binding, a blinded anchor, selective disclosure, verifier pseudonym, and age predicate | `credentials-birth-secret/src/test/capability-profiles.test.ts` |
| same-holder composition | Alice proves two credentials belong to the same hidden holder | `credentials-birth-secret/src/test/same-holder-composition.test.ts` |

### Why This Matters

Capability profiles stop everyone from waving their hands and saying:

- "yes yes, it supports privacy"

while quietly meaning five different things.

## Chapter 12: Midnight Stack Reality Check

This is the chapter where we stop pretending the whole story lives inside Compact.

It does not.

Midnight forces a healthier architecture:

- the holder prepares witnesses locally
- the application orchestrates the flow
- the contract verifies and applies business rules

### The Five Layers Again

| Layer | What it really owns |
| --- | --- |
| Layer 1 | generic proof and holder-binding capabilities |
| Layer 2 | concrete VC families, requests, disclosures, predicates |
| Layer 3 | product contract logic, state mutation, receipts, capabilities |
| Layer 4 | off-chain orchestration, wallet coordination, retries, multi-step protocol sequencing |
| Layer 5 | governance and trust policy for issuers, verifiers, schemas, and ecosystem rules |

### Why Layer 4 Comes Before Layer 3 In Human Understanding

Implementation dependencies go bottom-up.
Human understanding goes top-down.

For protocol reasoning, the off-chain layer comes first because it answers:

- who starts the interaction
- who creates or reads the request
- where the challenge comes from
- where witnesses are prepared
- who submits the final transaction

Only after that does the contract story become clean.

### Canonical Midnight Mental Model

```mermaid
sequenceDiagram
    participant VApp as Verifier App
    participant HApp as Holder App
    participant Contract as Contract

    VApp->>Contract: read policy or request shape
    Contract-->>VApp: typed requirements
    VApp->>HApp: request + challenge
    HApp->>HApp: build witnesses and proofs locally
    HApp->>Contract: submit credential, request, presentation, proofs, and public inputs
    Contract->>Contract: run verification circuits and apply business logic
```

### The Joke Hidden Inside The Architecture

Web SSI often encourages people to believe the message exchange is the system.

Midnight politely corrects them:

- no, the message exchange is the orchestration layer
- the system also has witness logic and contract semantics

This is annoying at first.
Then it becomes cleaner.

## Chapter 13: The Demo Contract Story

Suppose Vera runs an age-gated contract.

Alice wants access.

The first temptation is to imagine the contract initiating the interaction.
That is wrong.

The contract is passive.
It exposes state and circuits.
Alice or Vera's app must initiate the flow.

### Model A: Off-Chain Verifier-Led Flow

This is the more general SSI-style model.

1. Vera's application reads contract policy
2. Vera's application creates or derives the request and challenge
3. Alice receives that request off-chain
4. Alice prepares the presentation locally
5. Alice submits a transaction to the contract
6. The contract verifies and issues a capability

```mermaid
sequenceDiagram
    participant VeraApp as Vera App
    participant Alice as Alice
    participant Gate as Age-Gate Contract

    VeraApp->>Gate: read current policy
    Gate-->>VeraApp: policy / request shape
    VeraApp->>Alice: age-gate request + challenge
    Alice->>Alice: build presentation + witnesses locally
    Alice->>Gate: issueAgeGateCapability(...)
    Gate->>Gate: ageGateRequest(...)
    Gate->>Gate: verifyBirthPresentationForRequest(...)
    Gate->>Gate: assertValidBirthCredentialPresentation(...)
    Gate->>Gate: assertBirthPresentationSatisfiesRequest(...)
    Gate->>Gate: assertValidBirthCredentialAgePredicate(...)
    Gate-->>Alice: access capability
```

### Model B: Contract-Assisted Request Derivation

This is the demo-friendly Midnight variant.

1. Alice reads or reconstructs the contract request shape
2. Alice builds the presentation locally
3. Alice calls a contract circuit that reconstructs or checks the request internally
4. The contract verifies and returns the business result

```mermaid
sequenceDiagram
    participant Alice as Alice
    participant Gate as Age-Gate Contract

    Alice->>Gate: read policy / ageGateRequest(...)
    Gate-->>Alice: typed request parameters
    Alice->>Alice: build presentation + proof + witnesses locally
    Alice->>Gate: issueAgeGateCapability(...)
    Gate->>Gate: ageGateRequest(...)
    Gate->>Gate: verifyBirthPresentationForRequest(...)
    Gate->>Gate: issue access capability after successful verification
    Gate-->>Alice: return or record access capability
    Alice->>Gate: claimAgeGateCapability(...)
```

### What The Demo Contract Circuits Are Actually Doing

In `credentials-demo-contract/src/demo.compact`:

- `ageGateRequest(...)`
- `verifyBirthPresentation(...)`
- `verifyBirthPresentationForRequest(...)`
- `issueAgeGateCapability(...)`
- `claimAgeGateCapability(...)`

### In Plain Words

- `ageGateRequest(...)` exposes the contract's current typed requirements
- `verifyBirthPresentation(...)` checks that the credential was issued by the demo contract, the holder and issuer keys match stored expectations, and the age predicate is satisfied
- `verifyBirthPresentationForRequest(...)` additionally checks that the presentation satisfies the request structure and challenge
- `issueAgeGateCapability(...)` is business logic: verify first, then mint or record a reusable capability
- `claimAgeGateCapability(...)` consumes or checks the capability later

This is the important architectural point:

- credentials are not the end goal
- credentials are inputs into business logic

### Tests For This Chapter

- `credentials-demo-contract/src/test/demo.test.ts`

## Chapter 14: How Capabilities Compose

Here is the big picture.

```mermaid
flowchart TD
  A[Generic envelope and proof rules] --> B[Holder binding]
  B --> C[Selective disclosure]
  C --> D[Predicate proof]
  D --> E[Verifier-scoped pseudonym]
  E --> F[Same-holder composition]
  F --> G[Business contract action]
  G --> H[Application orchestration]
  H --> I[Governance and trust policy]
```

In plain words:

- first you need a typed envelope
- then you need issuer proof binding
- then you need holder binding
- then selective disclosure becomes meaningful
- then predicates become powerful
- then privacy capabilities reduce linkability
- then composition across credentials becomes practical
- then contracts can do something useful
- then applications coordinate real user journeys
- and eventually governance decides who should be trusted to participate at all

## Chapter 15: The Fifth Layer Nobody Wants To Build Too Early

Eventually someone asks the uncomfortable governance questions:

- which issuers are trusted for which schemas
- which verifiers are allowed to request which proofs
- which schema versions are acceptable
- which policy applies on which network

Congratulations.
You have discovered Layer 5.

### What Layer 5 Is

Layer 5 is governance and trust policy.

It may eventually include:

- trust registries
- issuer accreditation
- verifier authorization
- VC type support policy
- schema registration and version policy

### What Layer 5 Is Not

It is not the VC envelope.
It is not the proof primitive.
It is not the predicate logic.

Those belong in Layers 1 through 3.

### Why It Stays Abstract For Now

If we push governance into the VC core too early, the design gets muddy fast.

So for now:

- Layer 5 exists conceptually
- Layer 5 is documented as future scope
- Layer 5 must not distort the current VC/VP prototype

The future `MidnightTrustRegistry` idea belongs here.
Not inside the generic credential envelope.

## Chapter 16: What Mohawk Still Wants

Mohawk is happier now, but not done.

The current prototype still does not give us everything:

- full blind issuance is not implemented
- revocation is still out of scope
- application orchestration is prototyped in `credentials-protocol` but not yet production-hardened
- governance is acknowledged but intentionally abstract
- more credential families still need to be modeled

So the story is not over.

But it is no longer vague.
And that is real progress.

## Chapter 17: The Protocol Layer

Up to now, every test lived inside a single function scope.

Alice, Rita, and Vera shared variables like old college roommates sharing a bathroom shelf.
That is fine for circuit testing.
It is terrible for reasoning about who knows what.

Mohawk finally loses patience.

"In a real system," he says, "Alice does not get to peek inside Rita's wallet to grab the signing key.
And Vera does not casually read Alice's private witness material.
Party boundaries are real."

### Why Party Boundaries Matter

When every party lives in the same test function, it is easy to accidentally:

- pass a private witness from the holder to the verifier
- let the verifier construct something only the issuer should build
- skip a message exchange step because the data was already in scope

None of those bugs show up in the circuit layer.
They show up in the integration layer, which is exactly where most SSI systems go wrong.

### The Agent Model

`credentials-protocol` introduces three agent types:

| Agent | What it does |
| --- | --- |
| `IssuerAgent` / `SecretIssuerAgent` | creates offers, receives requests, issues credentials |
| `HolderAgent` / `SecretHolderAgent` | receives offers, sends requests, stores credentials, builds presentations |
| `VerifierAgent` | sends presentation requests, evaluates submissions, verifies same-holder proofs |

Each agent owns its own state.
They communicate only through a `MessageBus`.

### The MessageBus

The `MessageBus` is deliberately minimal:

- `send(message)` pushes a typed envelope to a named party queue
- `receive(party)` pops the next message for that party
- `drain(party)` collects all pending messages

It is not a real network.
It is a transport seam.

That means you can swap it for HTTP, DIDComm, or a blockchain-anchored channel later without touching the agent logic.

### The Contract Verifier

The off-chain `VerifierAgent` calls the circuit pure functions directly and evaluates the proof.

The `ContractVerifier` wraps the `CredentialsDemoSimulator` and represents an on-chain verifier.
It differs from the off-chain verifier in one important way:

- the contract verifier requires credentials to be registered first (via `issueBirthCredential`)
- the off-chain verifier only needs to see the proof and the credential

That distinction matters because the contract carries state.
The off-chain verifier is stateless.

Mohawk considers this "the correct separation of concerns".
He does not elaborate.

### What The Tests Cover

| Test file | What it proves |
| --- | --- |
| `credentials-protocol/src/test/explicit-holder/issuance.test.ts` | protocol-level issuance with party boundaries |
| `credentials-protocol/src/test/explicit-holder/presentation.test.ts` | presentation flow through the MessageBus |
| `credentials-protocol/src/test/explicit-holder/full-lifecycle.test.ts` | issuance through verification in one protocol run |
| `credentials-protocol/src/test/secret-holder/issuance.test.ts` | secret-holder issuance through agents |
| `credentials-protocol/src/test/secret-holder/presentation.test.ts` | hidden-holder presentation through agents |
| `credentials-protocol/src/test/secret-holder/pseudonym.test.ts` | verifier-scoped pseudonym through the protocol layer |
| `credentials-protocol/src/test/secret-holder/same-holder.test.ts` | same-holder composition through party-isolated agents |
| `credentials-protocol/src/test/contract-verifier/age-gate.test.ts` | contract verifier age-gate with protocol-issued credentials |
| `credentials-protocol/src/test/contract-verifier/capability-lifecycle.test.ts` | full capability lifecycle through the contract verifier |
| `credentials-protocol/src/test/helpers/message-bus.test.ts` | MessageBus transport primitives |

### Why This Chapter Exists

Without the protocol layer, the codebase proved that the circuits were correct.

With the protocol layer, the codebase now proves that the circuits remain correct when each party can only see its own state and messages arrive through a typed channel.

That is a different and harder claim.
And Mohawk is almost smiling.

## Chapter 18: The Standalone Environment

Mohawk trusts the circuits.
He trusts the protocol layer.
He does not trust the universe.

Specifically, he does not trust that a proof which passes the simulator will survive contact with a real Midnight node, a real indexer, and a real proof server all running at the same time.

Simulator tests prove the math is right.
Integration tests prove the stack works.
Those are different claims.

### What The Standalone Environment Provides

The `standalone-environment` package spins up a Docker-based Midnight stack:

- a Midnight node
- an indexer
- a proof server
- wallet setup and funding
- DID provisioning for issuer, holder, and verifier

That last part matters.
In the simulator tests, DIDs are invented on the spot.
In the standalone environment, DIDs are provisioned on a real ledger, which means the DID resolution path is exercised end-to-end.

### How It Connects To The Protocol Agents

The integration tests use the same `IssuerAgent`, `HolderAgent`, and `VerifierAgent` from `credentials-protocol`.
The only difference is the profile: real DID documents backed by on-ledger resolution instead of simulated identities.

That is the whole trick.
Same agents, same message bus, same protocol steps.
Different trust anchor underneath.

### When Docker Is Not Running

The integration tests detect whether the Docker environment is available.
If it is not, they skip gracefully.

That means:

- CI runs integration tests when Docker is provisioned
- local developers can run unit and simulator tests without Docker
- nobody gets a broken build because they forgot to start a container

### Why This Chapter Exists

The standalone environment is the bridge between "the circuits are correct" and "the system works".

It is also the bridge to future protocol work.
When OID4VCI or DIDComm transports arrive, this is the environment where they get tested against real infrastructure instead of polite simulations.

Mohawk considers this "the minimum acceptable level of paranoia".

### Tests For This Chapter

- `credentials-protocol/src/test/integration/explicit-holder-lifecycle.integration.test.ts`
- Integration tests require Docker and skip automatically when unavailable

## Where To Start In The Code

If you want the shortest path:

1. `credentials/src/credentials.compact`
   - generic VC/VP model, proof contexts, holder-binding primitives
2. `credentials/src/test/proof-context.test.ts`
   - proof basics and domain separation
3. `credentials/src/test/secret-holder-binding.test.ts`
   - hidden-holder basics and blinded variants
4. `credentials-same-holder/src/same-holder.compact`
   - the reusable same-holder capability
5. `credentials-same-holder/src/test/same-holder-capability.test.ts`
   - same-holder in isolation
6. `credentials-birth/src/birth-credential.compact`
   - explicit-holder birth family
7. `credentials-birth/src/test/capability-profiles.test.ts`
   - explicit-holder family profiles
8. `credentials-birth-secret/src/secret-birth-credential.compact`
   - privacy-oriented birth family
9. `credentials-birth-secret/src/test/capability-profiles.test.ts`
   - hidden-holder profiles
10. `credentials-birth-secret/src/test/same-holder-composition.test.ts`
   - same-holder composition in a real family
11. `credentials-demo-contract/src/demo.compact`
   - business contract composition
12. `credentials-demo-contract/src/test/demo.test.ts`
   - the end-to-end business story
13. `credentials-protocol/src/test/explicit-holder/issuance.test.ts`
   - protocol-level issuance with party boundaries
14. `credentials-protocol/src/test/secret-holder/same-holder.test.ts`
   - same-holder composition through the protocol layer
15. `credentials-protocol/src/test/contract-verifier/age-gate.test.ts`
   - contract verifier age-gate through the protocol layer
16. `credentials-protocol/src/test/integration/explicit-holder-lifecycle.integration.test.ts`
   - integration test with real Midnight DIDs (requires Docker)

## Final Mental Model

If you remember only one thing, remember this:

Midnight Credentials are not "JSON credentials copied onto a chain".

They are:

- typed claim structures
- commitment-based privacy
- witness-driven proofs
- challenge-bound presentations
- reusable capability layers
- off-chain orchestration plus on-chain verification
- future governance on top, not mixed into the core

Alice gets a credential.
Vera asks for proof.
Mohawk notices the next privacy leak.
The codebase adds one capability at a time.

That is the whole story.
