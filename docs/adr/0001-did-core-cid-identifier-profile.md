# ADR-0001: Common DID Core and CID Identifier Profile

- **Status:** Proposed
- **Date:** 2026-08-18
- **Issue:** [#425](https://github.com/midnightntwrk/midnight-did/issues/425)
- **Related:** [#405](https://github.com/midnightntwrk/midnight-did/issues/405)

## Context

`did:midnight` must describe and process identifiers consistently across:

- DID Core 1.0;
- Controlled Identifiers (CID) 1.0; and
- DID Core 1.1.

These specifications use related, but not identical, identifier requirements:

| Surface | DID Core 1.0 | CID 1.0 | DID Core 1.1 |
| --- | --- | --- | --- |
| `service.id` | URI conforming to RFC 3986 (§5.4) | Optional URL conforming to the WHATWG URL Standard (§2.1.4) | Service identifiers follow DID syntax or DID URL syntax (§5.4) |
| Relative references | URI references are permitted by the data model | A relative value is not a safe standalone CID URL value | Relative DID URLs are explicit and may contain path, query, and fragment components (§3.2.1) |
| Verification-method `id` | DID URL syntax (§5.2) | URL syntax (§2.2) | DID URL or relative DID URL (§5.2) |
| Fragment resolution | DID URL semantics | Canonical document URL plus fragment (§3.4) | RFC 3986 reference resolution (§3.2.1) |

A fragment-only ledger key is not a common identifier model. For example:

```text
#svc                  -> did:midnight:...#svc
/routing              -> did:midnight:.../routing
?service=messaging    -> did:midnight:...?service=messaging
/a#svc                != did:midnight:.../b#svc
```

Converting every relative value to a fragment loses path/query identity and can
make distinct service identifiers collide. Conversely, emitting only relative
identifiers is not the safest representation for CID 1.0, which requires a URL
when `service.id` is present.

CID 1.0 also defines fragment resolution, verification-method retrieval,
context injection, and processing errors. Supporting the CID data model does not
by itself claim full CID processor conformance. DID URL dereferencing remains a
separate tracked decision.

## Decision

`did:midnight` will use a **lossless absolute-DID-URL canonical form** while
accepting relative DID URLs at input boundaries.

### Identifier processing

1. Accept absolute URLs/DIDs and relative DID URL references where the target
   specification permits them.
2. Resolve relative DID URLs against the DID subject using RFC 3986 reference
   resolution, as required by DID Core 1.1.
3. Preserve path, query, and fragment components during resolution.
4. Use the resulting absolute DID URL as the canonical comparison, storage, and
   resolver-output identity.
5. Compare duplicate service and verification-method identifiers after this
   full resolution. Do not compare only fragments.
6. Keep canonical output lossless: `/routing` resolves to
   `did:midnight:.../routing`, not `did:midnight:...#/routing`.

For example, the following values are accepted as relative inputs and resolve
as follows:

| Input | Canonical identity |
| --- | --- |
| `#svc` | `did:midnight:...#svc` |
| `/routing` | `did:midnight:.../routing` |
| `?service=messaging` | `did:midnight:...?service=messaging` |
| `did:midnight:.../routing` | unchanged |
| `https://example.com/service` | unchanged, subject to method policy |

### Service identifiers

A service `id` is required by the `did:midnight` document profile, which is
compatible with DID Core 1.1's service property profile even though CID 1.0
allows it to be optional. Absolute URL values, including absolute DID URLs,
are the interoperable emitted form. Relative DID URLs remain supported as
input and storage-operation references after they can be resolved against the
DID subject.

Service identifiers are not required to be fragment-only. A method-specific
subject-binding restriction may be retained only if it is explicitly
classified as a restriction and does not get presented as universal CID or DID
interoperability.

### Verification methods and relationships

The same resolution model applies to verification-method identifiers and
relationship references. A relationship reference is compared with the full
canonical absolute identifier of its target, not with a fragment-only key.

External verification-method identifiers/controllers and key-material profiles
remain method-policy decisions. CID 1.0 `JsonWebKey` and `Multikey` support,
DID Core 1.1 restrictions, and the current Midnight cryptographic profile must
be documented separately.

### Contexts and processing

The method may use the DID context when it provides equivalent declarations to
the CID context, as permitted by CID 1.0 context injection. JSON-LD context
coverage and semantic round trips remain executable evidence requirements.

This ADR does not claim that the current resolver implements CID's complete
verification-method retrieval or DID URL dereferencing algorithms. Those
capabilities remain a separately tracked compatibility/conformance item.

## Alternatives considered

### Fragment-only canonicalization

Rejected. It is compact for ledger maps, but it changes the identity of path and
query references and makes distinct valid references collide.

### Relative-only canonical output

Rejected as the common output form. It is useful for DID Core 1.1 input and
compact representations, but an absolute URL is the safer intersection with CID
1.0's URL requirement and CID fragment-resolution algorithm.

### Preserve the original lexical spelling everywhere

Rejected as the comparison/storage identity. Different relative spellings can
resolve to the same absolute URL. Preserve the lexical form only when the
representation explicitly requires it; use the absolute resolved value for
identity and equality.

### Restrict all service IDs to subject fragments

Rejected as a default. A method may choose this restriction, but it is not
needed for DID Core/CID compatibility and prevents valid path, query, and
external URL service identifiers.

## Consequences

### Positive

- One identifier model works across DID Core 1.0, CID 1.0, and DID Core 1.1.
- Path, query, and fragment identity is preserved.
- Resolver output is suitable for CID-style URL and fragment processing.
- API add/update/remove operations can use the same canonical identity.
- Duplicate detection is deterministic and lossless.

### Negative

- Ledger keys are longer than fragment-only keys.
- API and resolver code need a real DID URL reference-resolution helper.
- Existing fragment/path legacy entries may require migration or redeployment.
- Full CID processor compatibility requires additional dereferencing,
  verification-material, context, and error-vector work.

## Implementation plan

1. Add shared absolute DID URL/reference normalization in the domain layer.
2. Replace fragment-only service and verification-method ledger keys with full
   canonical identifiers.
3. Update API add/update/remove operations to use the same canonicalization.
4. Update ledger-to-domain resolution to emit canonical absolute identifiers.
5. Add DID Core 1.0, CID 1.0, and DID Core 1.1 vectors for absolute, relative,
   path, query, fragment, external URL, and collision cases.
6. Update the method specification, repository guidance, and conformance
   matrices with explicit restrictions and evidence limits.
7. Keep DID URL dereferencing and resolver-service implementation separate from
   this repository unless a later decision changes the ownership boundary.

## Non-goals

- VC/VP semantics.
- Implementing the resolver service in this repository.
- Claiming W3C certification.
- Claiming full CID processor conformance before the required retrieval and
  dereferencing algorithms are implemented and tested.
