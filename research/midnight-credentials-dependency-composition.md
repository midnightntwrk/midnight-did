# Midnight Credentials Dependency Composition Model

Status: draft research note

## Problem

Midnight VC/VP packages are Compact-first. Concrete credential families expose
Compact structs and circuits, and the compiler generates TypeScript/JavaScript
artifacts for tests and applications. Layer 3 business contracts need a simple
way to import the credential families and protocol capabilities they require
without copying credential logic or depending on unstable generated internals.

The design goal is:

- Layer 3 contracts import concrete VC/VP/protocol capabilities directly.
- Generated TS/JS remains a build artifact, not the source of contract truth.
- Optional capabilities such as same-holder proofs do not become mandatory
  dependencies for every credential family.
- Published packages remain understandable for contract authors and wallet/app
  developers.

## Current Facts

The current repository already uses a layered package split:

| Layer | Package examples | Role |
|---|---|---|
| Layer 1 generic capabilities | `credentials`, `credentials-same-holder`, `credentials-iso-registry` | Generic VC/VP envelope, proof helpers, holder-binding profiles, same-holder circuits, shared code types |
| Layer 2 credential families | `credentials-birth`, `credentials-birth-secret`, `credentials-passport-secret`, `credentials-compliance` | Concrete claims, disclosures, requests, predicates, schema checks |
| Layer 3 business contracts | `credentials-demo-contract` | Contract state and business rules that compose one or more credential families |
| Layer 4 application/protocol orchestration | `credentials-protocol`, `credentials-openid`, `midnight-passport-prototype` | Transport/session/app coordination around Compact artifacts |

Important implementation detail:

- Compact source imports/includes are what matter for Layer 3 contract logic.
- Generated TS/JS artifacts are useful for tests, fixtures, serializers,
  application code, and package users, but Layer 3 Compact contracts should not
  treat generated TS/JS as an input dependency.

The current contracts use `include` for local Compact source composition and
module imports/prefixes for generic module instantiation, for example:

```compact
include "../../credentials-birth/src/birth-credential";

import VC<BirthCredentialClaims, BirthCredentialDisclosures, ExplicitHolderBinding>;

import IssuanceProtocol<
  BirthCredentialIssuanceOfferBody,
  BirthCredentialIssuanceRequestBody,
  BirthCredentialIssuanceResultBody
> prefix BirthCredentialIssuance_;
```

The Midnight MCP syntax reference confirms that Compact supports modular code
through imports, module generics, selective imports, and prefixes. The current
repo also relies on `include` for file-level source composition. The practical
recommendation is to keep the public package surface stable and compiler-tested
rather than expose arbitrary internal file paths.

## Recommended Package Shape

Each reusable credential package should publish three surfaces.

### 1. Compact Source Surface

This is the contract-author surface.

Recommended files:

```text
src/<family>.compact                 # canonical entry point
src/<family>/model.compact           # structs and request models
src/<family>/protocol-model.compact  # concrete protocol message bodies
src/<family>/helpers.compact         # roots, schema checks, constructor helpers
src/<family>/validation.compact      # assertion circuits and predicates
```

Rules:

- The top-level `<family>.compact` is the only stable Compact entry point for
  Layer 3 contracts.
- Internal files may exist for readability, but Layer 3 contracts should avoid
  importing them directly unless the package explicitly documents them as public.
- Public circuits should use family-prefixed names, such as
  `assertValidSecretPassportCredential` or
  `sanctionScreeningCredentialClaimRoot`, to avoid collisions after composition.
- Generic module instantiations should use prefixes, for example
  `SecretPassportCredentialIssuance_`, so generated protocol types remain
  readable and collision-resistant.

### 2. Generated Runtime Surface

This is the test/application surface produced by `compact compile`.

Recommended files:

```text
dist/managed/<family>/contract/index.js
dist/managed/<family>/contract/index.d.ts
dist/<family>.compact
```

Rules:

- Generated files are published for TypeScript consumers, fixtures, pure-circuit
  tests, and serialization codecs.
- Layer 3 Compact contracts should not import generated TS/JS.
- TS serializers should use generated Compact type descriptors or explicit
  package codecs, not ad-hoc JSON encoding.
- Generated APIs are version-coupled to the Compact compiler/runtime and should
  be treated as package build outputs.

### 3. TypeScript Convenience Surface

This is the app/wallet/test developer surface.

Recommended files:

```text
src/index.ts      # fixtures, codec exports, pureCircuits exports
src/codecs.ts     # Compact value encode/decode helpers for family structs
src/fixtures/*    # deterministic test fixtures only
```

Rules:

- Export family-specific helpers for app tests and prototype flows.
- Do not hide the Compact source model behind TypeScript-only abstractions.
- Keep fixtures clearly separated from production helper APIs.

## Layer 3 Composition Model

Layer 3 business contracts should be explicit about every credential family and
capability they need.

Recommended pattern:

```compact
pragma language_version >= 0.20;

import CompactStandardLibrary;

include "../../credentials-birth/src/birth-credential";
include "../../credentials-same-holder/src/same-holder";

export circuit verifyBusinessEligibility(
  credential: BirthCredential,
  credentialProof: Proof,
  request: BirthCredentialPresentationRequest,
  presentation: BirthCredentialPresentation,
  presentationProof: Proof,
  currentDay: Uint<32>
): [] {
  assertValidBirthCredentialPresentation(
    credential,
    credentialProof,
    presentation,
    presentationProof
  );
  assertBirthPresentationSatisfiesRequest(
    credential,
    request,
    presentation,
    presentationProof
  );

  // Business state mutation belongs here, not in the credential package.
}
```

For multi-credential policies, the Layer 3 contract should compose concrete
families directly:

```compact
include "../../midnight-passport-prototype/packages/credentials-passport-secret/src/secret-passport-credential";
include "../../midnight-passport-prototype/packages/credentials-compliance/src/sanction-screening-credential";
include "../../credentials-same-holder/src/same-holder";
```

Then the contract should:

1. verify each credential/presentation with its own family-specific circuits
2. apply cross-credential assertions such as same-holder proof
3. apply product-specific policy such as age, compliance freshness, or country
4. mutate business ledger state or return a typed business result

This keeps Layer 3 readable. A voting contract reads like a voting contract; an
auction contract reads like an auction contract. Credential packages provide
capabilities, not hidden product policy.

## Dependency Graph Recommendation

Use directed dependencies only from higher layers to lower layers:

```text
Layer 1 generic core
  credentials
  credentials-same-holder
  credentials-iso-registry
        ↑
Layer 2 concrete credential families
  credentials-birth
  credentials-birth-secret
  credentials-passport-secret
  credentials-compliance
        ↑
Layer 3 business contracts
  credentials-demo-contract
  future voting / auction / access contracts
        ↑
Layer 4 application orchestration
  credentials-protocol
  credentials-openid
  midnight-passport-prototype
```

Recommended constraints:

- Layer 1 must not depend on Layer 2 or Layer 3.
- Layer 2 may depend on Layer 1 and optional capability packages.
- Layer 3 may depend on only the Layer 2 families and Layer 1 capabilities it
  actually uses.
- Layer 4 may depend on generated TypeScript surfaces from Layer 1 through
  Layer 3, but should not change canonical Compact semantics.

## Capability Packages

Optional behaviors should live in small capability packages, not in a universal
credential super-package.

Current examples:

| Capability | Package | Why separate |
|---|---|---|
| Same-holder proof | `credentials-same-holder` | Needed only for multi-credential holder correlation |
| ISO code structs | `credentials-iso-registry` | Reusable data vocabulary, not VC semantics |
| OpenID-shaped transport DTOs | `credentials-openid` | TypeScript transport layer, not Compact contract logic |

Future candidate capability packages:

| Capability | Potential package | Notes |
|---|---|---|
| Revocation/status | `credentials-status` | Should remain optional until status model stabilizes |
| Nullifier/reuse prevention | `credentials-nullifier` | Useful for voting/access contracts, not mandatory for all VC families |
| Trust registry references | `credentials-trust-policy` | Likely Layer 5/governance-facing, not part of base credential validation |
| Requirement descriptors | `credentials-requirements` | Could help wallets understand Layer 3 contract requests if repeated patterns emerge |

## Versioning And Publishing Requirements

A credential package should version these together:

- Compact schema structs
- exported validation circuits
- generated TS/JS artifacts
- codecs and fixtures
- documented schema identifiers

Recommended package contents for publishing:

```text
package.json
README.md
dist/**
src/**/*.compact
```

Recommended `package.json` conventions:

- keep package name stable, for example
  `@midnight-ntwrk/midnight-did-credentials-passport-secret`
- include Compact sources in published files
- expose TypeScript entry points through `exports`
- document the stable Compact entry point path
- pin compatible `@midnight-ntwrk/compact-runtime` and Compact compiler/runtime
  expectations

Open question:

- The best published import path for Compact source dependencies needs a real
  package-consumer experiment. Today the repo uses relative `include` paths.
  Before publishing, create a small external consumer contract and verify the
  compiler can resolve the intended package source paths cleanly.

## Generated Code Guidance

Generated code is unavoidable and useful, but it should not leak into the wrong
layer.

Use generated code for:

- TypeScript type checking of fixture objects
- pure-circuit tests
- Compact value codecs and serialization
- application/wallet integration
- docs and API references

Do not use generated code for:

- defining canonical schema semantics
- Layer 3 contract imports
- cross-package Compact source composition
- business policy that should live in Compact

Rule of thumb:

> If the question is "what does this credential mean?", answer from Compact
> source. If the question is "how does TypeScript carry this credential?", use
> generated TS/JS and codecs.

## Recommended Next Prototype Task

Create a small dependency-composition spike with an external-consumer shape:

1. Add or generate a minimal Layer 3 contract that imports two concrete
   credential families and one optional capability package.
2. Keep all credential checks family-specific and all business state mutation in
   the Layer 3 contract.
3. Verify Compact compilation and generated TS artifacts.
4. Add a TypeScript test that imports the Layer 3 generated contract and proves
   the expected public types are usable.
5. Document the exact import paths that worked.

Candidate scenario:

- `credentials-demo-contract` or a new `credentials-investment-demo-contract`
  imports:
  - `credentials-passport-secret`
  - `credentials-compliance`
  - `credentials-same-holder`
- The contract verifies:
  - passport age and expiry
  - compliance PASS / PEP=false / freshness
  - same-holder binding
- The contract returns or stores an investment eligibility capability.

This would validate the composition model against the Midnight Passport use
case and produce the dependency guidance needed before publishing packages.

## Decision For Now

Use an explicit dependency composition model:

1. one stable Compact entry point per credential/capability package
2. concrete family packages export family-prefixed types and circuits
3. Layer 3 contracts include/import only the concrete families and optional
   capability packages they need
4. generated TS/JS artifacts are published for applications and tests, not for
   Compact contract source composition
5. no generic multi-credential bundle package until repeated Layer 3 contracts
   prove the abstraction is worth it
