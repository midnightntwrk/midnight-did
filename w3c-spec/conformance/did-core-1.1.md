# DID Core 1.1 Compatibility Matrix (Baseline Refresh)

**Baseline:** [W3C DID Core 1.1 Candidate Recommendation Snapshot, 05 March 2026](https://www.w3.org/TR/2026/CR-did-1.1-20260305/). **Audited commit:** `3bbd40a291a252d6348fae3983cd85fb13b8342b`.

DID Core 1.1 is tracked separately and is **not** substituted for the DID Core 1.0 Recommendation release gate. This initial matrix reuses the evidence rows in [the DID Core 1.0 matrix](./did-core-1.0.md), while recording where compatibility evidence is incomplete or requires a 1.1-specific review.

| Requirement family | DID Core 1.0 status | DID Core 1.1 compatibility | Midnight evidence | Focused action |
| --- | --- | --- | --- | --- |
| DID syntax and method-specific identifier | PASS WITH RESTRICTION | PASS WITH RESTRICTION | `packages/domain/src/midnight.ts`; `midnight.test.ts` | Re-run the full syntax/normalization fixture set against the 1.1 syntax sections. |
| DID URL syntax and parameters | UNKNOWN | UNKNOWN | `DIDStringSchema` intentionally rejects URL components; no dereference API | Decide and test supported URL parameters, paths, queries, and fragments. |
| DID Document `id`/`controller`/aliases | PASS WITH RESTRICTION | PASS WITH RESTRICTION | `midnight-did-document.ts`; `ledger-to-domain.ts` | Add null/malformed and subject-binding vectors. |
| Context and representation rules | PASS WITH RESTRICTION | UNKNOWN | DID/JWK contexts and JSON serialization are implemented; no complete 1.1 representation diff audit | Compare 1.1 representation requirements and add JSON-LD round-trip coverage. |
| Verification method structure | PASS WITH RESTRICTION | PASS WITH RESTRICTION | domain schemas and resolver mapping | Keep `JsonWebKey` method boundary explicit; test all supported profiles. |
| Verification relationships | PASS | PASS | relation schemas/mappers and contract relation tests | Add complete negative vectors for missing/duplicate targets. |
| Service data model | PASS WITH RESTRICTION | PASS WITH RESTRICTION | `ServiceSchema`, ledger service mapping | Complete duplicate and malformed endpoint vectors. |
| Optional-member omission/null behavior | PASS | PASS | constructors omit absent members and generic/method-specific schemas reject `null` | Retain regression coverage as the 1.1 compatibility gate; the current baseline includes the Phase 2 behavior. |
| DID JSON representation | PASS WITH RESTRICTION | UNKNOWN | `resolveRepresentation` and resolver tests | Verify 1.1 representation changes and semantic equivalence. |
| DID JSON-LD representation | PASS | UNKNOWN | deterministic expansion test, no compaction round trip | Add compact/expand semantic round-trip tests under the 1.1 baseline. |
| Create/read/update/deactivate method operations | PASS WITH RESTRICTION | PASS WITH RESTRICTION | contract/API lifecycle and resolver tests | Add deterministic lifecycle vectors and map any 1.1 clarification. |
| Resolution result envelope | PASS | UNKNOWN | `resolveDIDResolutionResult` and tests | Cross-reference the separately pinned DID Resolution baseline and 1.1 wording. |
| Security considerations | PASS WITH RESTRICTION | UNKNOWN | method §8 and authorization tests | Perform a 1.1-specific security/privacy delta review before publication. |
| Privacy considerations | PASS WITH RESTRICTION | UNKNOWN | method §9; no dedicated executable test | Review any 1.1 changes and document evidence limits. |
| Multikey/publicKeyMultibase | KNOWN INTEROPERABILITY LIMITATION | KNOWN INTEROPERABILITY LIMITATION | method §3.4.4 explicitly excludes this profile | Do not add Multikey in #405; track ecosystem work separately. |
| DID URL dereferencing | UNKNOWN | UNKNOWN | no dereference operation or tests found | P0 maintainer decision; implement or document as an explicit limitation. |
