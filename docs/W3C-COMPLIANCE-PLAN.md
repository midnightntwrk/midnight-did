# Midnight DID — W3C Conformance Implementation Guide

## Purpose

This document is an implementation guide for making the `did:midnight` method demonstrably conformant with the applicable W3C DID specifications and for publishing reproducible conformance evidence.

The goal is **not** to claim that W3C certifies individual DID methods. Instead, the project should produce:

1. a normative DID Core conformance matrix;
2. executable conformance tests;
3. reproducible evidence and reports;
4. documented interoperability limitations;
5. a clear DID Resolution compliance posture;
6. a decision and implementation plan for registration of `did:midnight` in the W3C DID Method registry.

Primary tracking issue:

- https://github.com/midnightntwrk/midnight-did/issues/405

Related historical issue:

- https://github.com/midnightntwrk/midnight-did/issues/249

---

# 1. Target Standards

Use the following standards as the normative baselines.

## Required baseline

### W3C DID Core 1.0

- https://www.w3.org/TR/did-core/

Treat DID Core 1.0 as the primary conformance target because it is a W3C Recommendation.

Important sections include:

- DID syntax
- DID Documents
- verification methods
- verification relationships
- services
- DID resolution concepts
- DID method operations
- security considerations
- privacy considerations

## Forward-compatibility target

### W3C DID Core 1.1

Track DID Core 1.1 compatibility separately.

Do not replace DID Core 1.0 as the normative release gate until DID Core 1.1 reaches W3C Recommendation status.

The report should contain separate columns for:

- DID Core 1.0
- DID Core 1.1 compatibility

## DID Resolution

Use the current W3C DID Resolution specification as the target for:

- `resolve`
- `resolveRepresentation`
- resolution metadata
- document metadata
- representation negotiation
- error behavior
- DID URL dereferencing

Reference:

- https://www.w3.org/TR/did-resolution/

Record the exact DID Resolution version/date used by the test report because this specification can evolve independently of DID Core.

## DID Method registration

Use the current W3C DID extensions / DID methods registry process.

Registration is separate from DID Core conformance.

Registry inclusion MUST NOT be presented as:

- W3C certification;
- W3C endorsement;
- proof that all cryptographic profiles are interoperable.

---

# 2. Current Working Assumption

Do not start with a large redesign.

The repository already appears to support most core DID functionality, including:

- DID syntax
- DID Documents
- verification methods
- verification relationships
- services
- aliases
- DID metadata
- resolution metadata
- updates
- deactivation
- controller rotation
- recovery
- JSON DID representation
- JSON-LD DID representation
- structured resolution errors

The primary work should therefore be:

1. audit;
2. prove;
3. test;
4. fix actual normative failures;
5. document limitations;
6. publish evidence;
7. register the method.

---

# 3. Important Scope Boundary

Keep the following three concepts separate.

## 3.1 DID Core conformance

Answers:

> Does `did:midnight` satisfy the normative W3C DID method and DID Document requirements?

## 3.2 DID Resolution conformance

Answers:

> Does the resolver correctly implement resolution, representations, metadata, errors, and optionally dereferencing?

## 3.3 Ecosystem interoperability

Answers:

> Can generic JOSE, JSON-LD, Multikey, Data Integrity, BBS, and other third-party tooling consume all Midnight verification methods?

These are related but are not equivalent.

For example:

- absence of `Multikey` does not automatically make a DID method non-conformant;
- a Midnight-private JWK `crv` may fit the DID Core data model while still having weak JOSE interoperability;
- DID Core conformance does not imply support for every W3C Data Integrity cryptosuite.

---

# 4. Proposed Repository Structure

Add a dedicated conformance area.

```text
w3c-spec/
├── midnight-method.md
├── midnight-did-traits.md
└── conformance/
    ├── README.md
    ├── did-core-1.0.md
    ├── did-core-1.1.md
    ├── did-resolution.md
    ├── interoperability.md
    ├── registry.md
    └── test-results/
        └── .gitkeep
```

Add executable conformance tests.

Suggested structure:

```text
packages/
└── conformance/
    ├── package.json
    ├── src/
    │   ├── did-core/
    │   ├── did-resolution/
    │   ├── representations/
    │   ├── lifecycle/
    │   └── interoperability/
    ├── fixtures/
    │   ├── valid/
    │   ├── invalid/
    │   ├── representations/
    │   └── lifecycle/
    └── scripts/
        └── generate-report.ts
```

If creating a new package is unnecessarily heavy for the current monorepo, place these tests in the existing DID package under a clear namespace such as:

```text
packages/did/src/conformance/
```

Prefer the smallest architectural change that gives the tests a clear, stable location.

---

# 5. Deliverable 1 — DID Core 1.0 Conformance Matrix

Create:

```text
w3c-spec/conformance/did-core-1.0.md
```

The matrix MUST map every applicable normative DID Core requirement to:

- W3C section;
- Midnight specification section;
- implementation location;
- automated test;
- result;
- notes.

Use this structure:

| ID | Requirement | W3C section | Midnight spec | Implementation | Test | Status | Notes |
|---|---|---|---|---|---|---|---|
| DID-001 | DID syntax is valid | DID Core | §2 | parser | test | PASS | |
| DID-002 | method-specific-id rules defined | DID Core | §2 | parser/builder | test | PASS | |
| DID-003 | normalization rules documented | DID Core | §2 | parser | test | PASS/FAIL | |
| DOC-001 | DID Document contains valid `id` | DID Core | §3 | mapper | test | PASS | |
| VM-001 | verification methods valid | DID Core | §3.x | schema | test | PASS | |
| REL-001 | authentication is valid | DID Core | §3.x | mapper | test | PASS | |
| SRV-001 | services are valid | DID Core | §3.x | mapper | test | PASS | |
| CRUD-001 | create is defined | DID Core | §7 | contract | integration | PASS | |
| CRUD-002 | read/resolve is defined | DID Core | §7 | resolver | integration | PASS | |
| CRUD-003 | update is defined | DID Core | §7 | contract | integration | PASS | |
| CRUD-004 | deactivate is defined | DID Core | §7 | contract | integration | PASS | |

Allowed statuses:

```text
PASS
PASS WITH RESTRICTION
NOT APPLICABLE
KNOWN INTEROPERABILITY LIMITATION
FAIL
```

Do not use only boolean yes/no values.

A known interoperability limitation is not necessarily a DID Core failure.

---

# 6. Deliverable 2 — DID Core 1.1 Compatibility Matrix

Create:

```text
w3c-spec/conformance/did-core-1.1.md
```

This report SHOULD reference the DID Core 1.0 matrix rather than duplicate all evidence.

Suggested form:

| Requirement | DID Core 1.0 | DID Core 1.1 | Midnight status | Action |
|---|---:|---:|---|---|
| DID syntax | required | required | PASS | none |
| DID Documents | required | required | PASS | none |
| verification methods | required | required | PASS | none |
| services | required | required | PASS | none |
| security considerations | required | changed/clarified | REVIEW | audit |
| privacy considerations | required | changed/clarified | REVIEW | audit |

The objective is to avoid a second large conformance project later.

---

# 7. Deliverable 3 — DID Syntax Audit

Audit the DID syntax defined in:

```text
w3c-spec/midnight-method.md
```

The method currently includes multiple network profiles and offchain DIDs.

Test at minimum:

```text
did:midnight:undeployed:<id>
did:midnight:devnet:<id>
did:midnight:testnet:<id>
did:midnight:mainnet:<id>
did:midnight:preview:<id>
did:midnight:preprod:<id>
did:midnight:offchain:<hash>
did:midnight:offchain:<hash>:<encoded-state>
```

## Important normalization question

The specification currently permits uppercase hexadecimal characters for some identifiers while recommending lowercase.

Resolve this explicitly.

The specification MUST state whether:

```text
ABCDEF...
```

and:

```text
abcdef...
```

represent:

- the same DID after normalization; or
- two distinct DIDs.

Add tests for this behavior.

Do not leave normalization dependent on implementation accident.

Also test:

- invalid method name;
- missing network;
- unsupported network;
- invalid identifier length;
- invalid hex;
- invalid offchain base64url;
- trailing colon;
- invalid offchain hash;
- offchain hash mismatch;
- extra method-specific components.

---

# 8. Deliverable 4 — DID Document Data Model Audit

Audit all emitted DID Documents.

At minimum inspect:

```text
id
controller
alsoKnownAs
verificationMethod
authentication
assertionMethod
keyAgreement
capabilityInvocation
capabilityDelegation
service
```

## Verification method requirements

Validate:

```text
verificationMethod.id
verificationMethod.type
verificationMethod.controller
verificationMethod.publicKeyJwk
```

Ensure IDs resolve consistently against the DID subject. The common profile is
specified by [ADR-0001](./adr/0001-did-core-cid-identifier-profile.md): accept
relative DID URL references at input boundaries, resolve them with RFC3986,
and use the resulting absolute URL as the identity.

Path, query, and fragment components MUST remain distinct. For example:

```text
#svc               -> did:midnight:...#svc
/routing           -> did:midnight:.../routing
?service=messaging -> did:midnight:...?service=messaging
/a#svc             != did:midnight:.../b#svc
```

Test absolute DID URLs, absolute non-DID service URLs, relative fragments,
relative paths, relative queries, equivalent absolute/relative references,
and same-fragment path collision cases.

## Verification relationship requirements

If a verification relationship is empty, prefer omitting the property.

Do not emit:

```json
{
  "keyAgreement": null
}
```

A property that is present MUST have a valid value according to the DID data model.

Add explicit regression tests for the issue previously tracked in #249.

## Service requirements

Test:

```text
service.id
service.type
service.serviceEndpoint
```

Cover all supported `serviceEndpoint` shapes if Midnight supports:

- string;
- object;
- array.

Include malformed fixtures.

---

# 9. Deliverable 5 — JSON and JSON-LD Representation Tests

Treat DID data model and DID representations separately.

## application/did+json

Test that:

- output is valid JSON;
- no JSON-LD-only `@context` field is required;
- consuming the representation recreates an equivalent DID data model.

## application/did+ld+json

Test that:

- `@context` is present;
- all emitted terms expand correctly;
- JSON-LD expansion succeeds;
- JSON-LD compaction succeeds;
- a round trip preserves semantic equivalence.

Test flow:

```text
DID data model
    ↓
produce
    ↓
application/did+ld+json
    ↓
JSON-LD expand
    ↓
JSON-LD compact
    ↓
equivalent DID data model
```

This is especially important for:

- verification method `type`;
- custom contexts;
- custom cryptographic terms.

---

# 10. Deliverable 6 — DID Resolution Conformance

Create:

```text
w3c-spec/conformance/did-resolution.md
```

Audit both resolution APIs.

Expected abstract resolution result:

```json
{
  "didResolutionMetadata": {},
  "didDocument": {},
  "didDocumentMetadata": {}
}
```

Expected representation result:

```json
{
  "didResolutionMetadata": {
    "contentType": "application/did+ld+json"
  },
  "didDocumentStream": "...",
  "didDocumentMetadata": {}
}
```

Test at minimum:

1. valid DID;
2. unknown DID;
3. malformed DID;
4. network mismatch;
5. unsupported method/profile;
6. deactivated DID;
7. unsupported `Accept`;
8. internal ledger/indexer failure;
9. valid `application/did+json`;
10. valid `application/did+ld+json`;
11. wildcard `Accept`;
12. weighted `Accept` values;
13. zero-quality unsupported media types.

Validate standard resolution errors where applicable:

```text
invalidDid
notFound
representationNotSupported
methodNotSupported
internalError
```

Do not leak arbitrary internal exception text as the primary public error contract.

Record the exact DID Resolution specification version/date used for the audit.

---

# 11. Deliverable 7 — DID URL Dereferencing Audit

Determine whether the current implementation supports DID URL dereferencing.

Examples:

```text
did:midnight:testnet:<id>#key-1
did:midnight:testnet:<id>#service-1
```

Expected behavior should allow retrieval of the corresponding DID Document resource.

Audit:

- fragment verification method dereferencing;
- fragment service dereferencing;
- unknown fragment;
- malformed DID URL;
- unsupported parameters;
- unsupported paths;
- unsupported queries.

If dereferencing is not implemented:

1. document it clearly;
2. do not claim full DID Resolution conformance;
3. create a separate implementation issue.

Suggested issue:

```text
DID-CONF-005 — Implement or formally document DID URL dereferencing
```

Do not silently treat bare DID resolution as equivalent to full DID URL dereferencing.

---

# 12. Deliverable 8 — DID Method CRUD Semantics

Map Midnight operations to the DID Core conceptual operations.

```text
DID Core       Midnight

Create    ->   contract / initial state publication
Read      ->   resolver / ledger state projection
Update    ->   authorized DID update operation
Deactivate->   DID deactivation operation
```

Midnight-specific extensions include:

```text
controller rotation
recovery
offchain DID state
```

These are method-specific lifecycle features, not new DID Core operations.

For each CRUD operation, create reproducible test vectors containing:

```text
initial state
operation
authorization
resulting state
resolved DID Document
DID Document metadata
```

Use deterministic fixtures where possible.

---

# 13. Deliverable 9 — Cryptographic Interoperability Profile

Create:

```text
w3c-spec/conformance/interoperability.md
```

Do not mix crypto interoperability limitations with DID Core conformance failures.

Use a matrix similar to:

| Profile | DID Core representation | JOSE interoperability | Multikey/Data Integrity | Midnight support |
|---|---:|---:|---:|---:|
| Ed25519 JWK | yes | yes | separate profile | yes |
| X25519 JWK | yes | yes | separate profile | yes |
| P-256 JWK | yes | yes | separate profile | yes |
| secp256k1 JWK | yes | yes | separate profile | yes |
| Jubjub JWK | yes | Midnight-specific | no generic support | yes |
| BLS12381G1 JWK | yes | profile-dependent | limited | yes |
| BLS12381G2 JWK | yes | profile-dependent | limited | yes |
| Multikey | optional | n/a | strong ecosystem support | no |

## Jubjub

Treat `Jubjub` as a Midnight-specific interoperability profile unless and until it has appropriate external registration.

Document something equivalent to:

> Jubjub verification methods use the DID Core `publicKeyJwk` verification-material property with a Midnight-specific JWK curve identifier. Generic JOSE implementations that do not recognize the curve cannot use the key.

Do not claim generic JOSE compatibility.

## BLS

Verify the current external standardization status of the exact BLS curve identifiers before making interoperability claims.

Do not rely on historical draft names without documenting the current source.

## Multikey

Absence of:

```text
type: Multikey
publicKeyMultibase
```

should be documented as an ecosystem limitation, not automatically treated as a DID Core failure.

Keep Multikey implementation outside the scope of issue #405 unless the conformance audit finds a direct normative dependency.

---

# 14. Follow-up Interoperability Issues

Create separate issues if they do not already exist.

Suggested backlog:

```text
DID-INTEROP-001 — Add Multikey/publicKeyMultibase verification-method profile
DID-INTEROP-002 — Define/register Jubjub multicodec profile
DID-INTEROP-003 — Align BLS key profiles with current standards
```

These SHOULD NOT block completion of #405 unless the conformance report discovers a direct normative failure.

---

# 15. Deliverable 10 — Automated Conformance Suite

Add an executable test command.

Preferred:

```bash
pnpm test:conformance
```

The command SHOULD:

1. run DID syntax tests;
2. run DID Document model tests;
3. run JSON representation tests;
4. run JSON-LD representation tests;
5. run resolution tests;
6. run dereferencing tests if implemented;
7. run lifecycle tests;
8. produce machine-readable output;
9. produce a Markdown report.

Suggested artifacts:

```text
artifacts/w3c-conformance/
├── did-core.json
├── did-core-1.1.json
├── did-resolution.json
├── junit.xml
└── report.md
```

Example summary:

```text
DID Core 1.0
------------
Applicable assertions: 93
Passed:               93
Failed:                0

DID Core 1.1 compatibility
--------------------------
Applicable assertions: 101
Passed:                 99
Review required:         2

DID Resolution
--------------
Applicable assertions: 33
Passed:                 31
Not implemented:         2

Known interoperability limitations
----------------------------------
Jubjub private JOSE curve profile
BLS profile-dependent interoperability
Multikey unsupported
```

Never remove a failing normative assertion merely to make the report green.

A failure MUST result in:

- implementation fix;
- specification fix;
- or an explicit documented conformance failure.

---

# 16. External W3C / Community Test Suite

Evaluate the currently available W3C DID test suites and implementation-report tooling.

If suitable:

1. fork or configure the suite;
2. add `did:midnight` fixtures;
3. run all applicable DID method tests;
4. commit reproducible configuration;
5. publish generated reports.

If the suite is stale or does not match the current target standard:

1. document this;
2. still run the applicable subset where useful;
3. rely on the project-owned normative assertion matrix as the canonical evidence.

Do not treat an external suite as a replacement for reading normative requirements.

---

# 17. Deliverable 11 — Public Conformance Report

Create:

```text
w3c-spec/conformance/README.md
```

Suggested structure:

```markdown
# Midnight DID W3C Conformance Report

## Scope

## Standards and versions

## Tested implementation

## Test environment

## DID Core 1.0 conformance

## DID Core 1.1 compatibility

## DID Resolution

## DID URL dereferencing

## DID representations

## DID method operations

## Cryptographic profiles

## Known interoperability limitations

## Reproduction instructions

## CI artifacts

## W3C registry status
```

The report MUST identify the exact tested version.

Example:

```text
Repository commit: <sha>
midnight-did version: <version>
contract version: <version>
Node.js: <version>
pnpm: <version>

DID Core baseline:
W3C Recommendation <date>

DID Core 1.1 compatibility baseline:
W3C Candidate Recommendation <date>

DID Resolution baseline:
W3C Working Draft <date>
```

The report MUST NOT make timeless claims without identifying the implementation and standard versions used.

---

# 18. Deliverable 12 — W3C DID Method Registry

After the normative audit is complete, prepare registration of:

```text
did:midnight
```

Create:

```text
w3c-spec/conformance/registry.md
```

Document:

- canonical method name;
- specification URL;
- repository URL;
- maintainers;
- contact information;
- status;
- required method-registry metadata;
- registry submission PR;
- review comments;
- final result.

Before submission verify:

1. `midnight` does not conflict with another registered DID method;
2. the method specification has a stable public URL;
3. the specification covers DID Core method requirements;
4. security considerations are complete;
5. privacy considerations are complete;
6. create/read/update/deactivate are documented;
7. identifier generation and normalization are documented;
8. examples are current and tested.

Public language MUST state:

> Registry inclusion is not W3C certification or endorsement.

---

# 19. Suggested Work Breakdown

Implement #405 as the following work items.

## DID-CONF-001 — DID Core 1.0 normative matrix

### Acceptance criteria

- every applicable normative DID Core requirement is listed;
- every requirement links to implementation/spec evidence;
- every requirement has an automated test or documented reason why automation is impossible;
- no unexplained gaps remain.

---

## DID-CONF-002 — DID Core 1.1 compatibility matrix

### Acceptance criteria

- relevant 1.1 changes are mapped;
- gaps are classified;
- follow-up issues exist for incompatibilities.

---

## DID-CONF-003 — DID Document representation tests

### Acceptance criteria

- `application/did+json` tested;
- `application/did+ld+json` tested;
- JSON-LD expansion/compaction tested;
- empty optional relationships are not emitted as `null`;
- malformed fixtures are rejected.

---

## DID-CONF-004 — DID Resolution conformance

### Acceptance criteria

- success envelope tested;
- failure envelopes tested;
- representation negotiation tested;
- standard error identifiers tested;
- document metadata tested;
- resolution metadata tested.

---

## DID-CONF-005 — DID URL dereferencing audit

### Acceptance criteria

One of:

- dereferencing is implemented and tested;

or:

- dereferencing is documented as unsupported and a follow-up implementation issue is created.

---

## DID-CONF-006 — CRUD lifecycle test vectors

### Acceptance criteria

- create;
- resolve;
- update;
- deactivate;
- controller rotation;
- recovery;

all have deterministic or reproducible test vectors.

---

## DID-CONF-007 — Cryptographic interoperability profile

### Acceptance criteria

- registered/common curves documented;
- Jubjub limitation documented;
- BLS status documented;
- Multikey limitation documented;
- DID Core compliance is clearly separated from crypto interoperability.

---

## DID-CONF-008 — External test-suite integration

### Acceptance criteria

- applicable external suite evaluated;
- configuration committed if useful;
- test results reproducible;
- unsupported/stale areas documented.

---

## DID-CONF-009 — Publish conformance report

### Acceptance criteria

- report generated from current tests;
- exact commit SHA recorded;
- standards versions recorded;
- reproduction commands documented;
- known limitations visible.

---

## DID-CONF-010 — W3C DID Method registry submission

### Acceptance criteria

- registry requirements checked;
- `did:midnight` metadata prepared;
- registration PR opened;
- review comments resolved or tracked;
- registry status documented.

---

# 20. CI Integration

Add a CI job named approximately:

```text
w3c-conformance
```

Suggested workflow:

```text
install
  ↓
build
  ↓
unit tests
  ↓
conformance tests
  ↓
generate report
  ↓
upload artifacts
```

The CI job SHOULD fail when:

- a normative conformance test fails;
- a previously passing assertion becomes failing;
- the generated matrix/report is stale;
- JSON-LD validation fails;
- representation tests fail.

The CI job SHOULD NOT fail merely because:

- Multikey is unsupported;
- Jubjub is not understood by generic JOSE libraries;
- another explicitly documented interoperability feature is outside project scope.

Those limitations should instead appear in the report.

---

# 21. Recommended Public Claim

After successful completion, use evidence-backed language.

Preferred wording:

> The Midnight DID method has been audited against W3C DID Core requirements and includes reproducible conformance tests and DID Resolution evidence. The method uses a defined Midnight cryptographic profile, and interoperability limitations for Jubjub, BLS, and Multikey are documented separately.

Avoid:

> W3C certified.

Avoid:

> Fully W3C compatible.

Avoid:

> Supports all W3C DID verification methods.

Avoid:

> Fully interoperable with all W3C identity tooling.

---

# 22. Definition of Done for Issue #405

Issue #405 is complete when all of the following are true:

- [ ] DID Core 1.0 normative matrix exists.
- [ ] DID Core 1.1 compatibility matrix exists.
- [ ] All applicable DID Document requirements are tested.
- [ ] JSON and JSON-LD representations are tested independently.
- [ ] DID Resolution success and error behavior is tested.
- [ ] DID URL dereferencing is implemented or explicitly documented as unsupported.
- [ ] CRUD lifecycle behavior has reproducible test vectors.
- [ ] controller rotation and recovery behavior are documented and tested.
- [ ] Jubjub interoperability limitations are documented.
- [ ] BLS interoperability limitations are documented.
- [ ] Multikey/publicKeyMultibase limitation is documented.
- [ ] External W3C/community suite applicability is evaluated.
- [ ] reproducible test commands are documented.
- [ ] CI publishes conformance evidence.
- [ ] public conformance report is published.
- [ ] the exact tested commit and standards versions are recorded.
- [ ] W3C DID Method registry submission is completed or an explicit decision not to submit is documented.
- [ ] public wording does not imply W3C certification.

---

# 23. Implementation Principles for the Agent

When implementing this initiative:

1. **Do not redesign the DID method without evidence of a normative failure.**
2. Prefer tests and documentation before structural refactors.
3. Treat W3C normative statements (`MUST`, `MUST NOT`, `SHOULD`) explicitly.
4. Every discovered `MUST`/`MUST NOT` violation should become either:
   - a fix in the same change;
   - or a separately tracked issue.
5. Do not suppress failing conformance assertions.
6. Do not mix DID Core failures with ecosystem-interoperability limitations.
7. Keep Multikey/Jubjub/BLS expansion outside #405 unless required for actual conformance.
8. Prefer deterministic fixtures over live-network-only tests.
9. Keep test results reproducible from a clean checkout.
10. Record exact standard versions and commit SHA in every generated report.
11. Keep documentation and implementation synchronized.
12. Update examples whenever schemas or representations change.
13. Avoid marketing terminology in normative documents.
14. Prefer evidence-backed language.

---

# 24. First Implementation Steps

Start with these actions in order.

## Step 1

Inspect:

```text
w3c-spec/midnight-method.md
w3c-spec/midnight-did-traits.md
packages/domain/src/did-document.ts
packages/did/src/midnight-did-resolver.ts
packages/did/src/ledger-to-domain.ts
packages/api/
packages/contract/
```

Also inspect the tests related to:

```text
DID parsing
DID Document projection
resolution
representation
updates
deactivation
recovery
```

## Step 2

Create:

```text
w3c-spec/conformance/did-core-1.0.md
```

Populate it with all applicable normative requirements before changing implementation.

## Step 3

Mark each item:

```text
PASS
FAIL
UNKNOWN
NOT APPLICABLE
INTEROPERABILITY LIMITATION
```

## Step 4

Convert every `UNKNOWN` into evidence.

## Step 5

Convert every `FAIL` into either:

- an implementation/spec fix;
- or a separately tracked issue.

## Step 6

Add automated conformance tests.

## Step 7

Generate the first conformance report.

## Step 8

Only after the audit is green, prepare W3C method-registry submission.

---

# 25. Final Expected Result

At the end of this initiative the repository should be able to answer, with evidence:

```text
Is did:midnight DID Core conformant?
→ See w3c-spec/conformance/did-core-1.0.md

Is it compatible with DID Core 1.1?
→ See w3c-spec/conformance/did-core-1.1.md

Does the resolver implement DID Resolution correctly?
→ See w3c-spec/conformance/did-resolution.md

Can generic tooling use every Midnight key type?
→ See w3c-spec/conformance/interoperability.md

How can I reproduce the evidence?
→ pnpm test:conformance

Which exact version was tested?
→ See generated conformance report.

Is did:midnight registered with W3C?
→ See w3c-spec/conformance/registry.md
```

The core principle is:

> Do not make the Midnight DID method “W3C compliant” by adding features indiscriminately. Prove the existing method against the normative requirements, fix actual conformance gaps, document deliberate interoperability limitations, and publish reproducible evidence.
