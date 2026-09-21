# ADR: Jubjub JWK Coordinate Encoding

## Status

Accepted for Midnight DID 0.7.

Related issue: [midnightntwrk/midnight-did#503](https://github.com/midnightntwrk/midnight-did/issues/503)

## Context

Midnight stores SchnorrJubjub public keys as native `JubjubPoint` values. Its
native field serialization is little-endian, and Midnight DID versions through
0.6 reused that byte order when projecting affine coordinates into the `x` and
`y` members of an EC JSON Web Key (JWK).

EC JWK coordinates do not inherit a curve implementation's native field
serialization. [RFC 7518 Sections 6.2.1.2 and 6.2.1.3](https://www.rfc-editor.org/rfc/rfc7518.html#section-6.2.1)
refer to the fixed-width octet-string representation defined by SEC1, which
encodes an unsigned field element in big-endian order. A private, unregistered
`crv: "Jubjub"` value does not redefine the standard semantics of the JWK `x`
and `y` members.

The 0.6 representation is already present in persisted DID Documents, caches,
test fixtures, JWK thumbprints, and downstream credential integrations. The
historical `midnight-offchain-did-state-v1.base64url` (`MOD1`) format also stores
Jubjub coordinates as fixed-width little-endian fields. Changing MOD1 bytes
would change existing long-form DID identifiers and state hashes.

An unmarked 32-byte value cannot safely identify its byte order. Trying both
orders is ambiguous and would make interpretation depend on point validity or
consumer behavior.

## Decision

Starting with Midnight DID 0.7, every resolved SchnorrJubjub `publicKeyJwk`
uses this profile:

- `kty` is `EC`;
- `crv` is `Jubjub`;
- `x` and `y` are canonical unpadded base64url strings;
- each decoded coordinate is exactly 32 octets;
- each coordinate is the unsigned field element in big-endian order, left
  padded with zero octets; and
- each decoded integer is strictly less than the Jubjub base-field modulus.

The domain package owns the canonical codec through
`encodeJubjubJwkCoordinate` and `decodeJubjubJwkCoordinate`. New 0.7 writers
emit only this representation. JWK readers accept only this representation and
must not infer, auto-detect, or retry a legacy byte order.

The native ledger point remains the source of truth. Ledger-to-domain mapping
converts its coordinates to the JWK profile only when constructing a DID
Document. This decision does not change contract storage, point arithmetic,
Schnorr transcripts, signatures, verification-method identifiers, or ledger
state.

The MOD1 v1 wire format remains byte-for-byte stable. Its `keyKind = 1` fields
continue to contain fixed-width little-endian Jubjub coordinates. The offchain
codec reverses those wire bytes deterministically at the domain boundary:

- decoding MOD1 converts the historical little-endian field to the 0.7
  big-endian JWK representation; and
- encoding a 0.7 JWK converts the coordinate back to the historical MOD1 field.

This preserves existing long-form DID identifiers and state hashes while
ensuring that every JWK exposed by the 0.7 domain API has one canonical meaning.
The internal MOD1 string is a versioned wire field, not a JWK.

Persisted 0.6 DID Document snapshots remain historical 0.6 material. Consumers
must re-resolve ledger-backed DIDs with a 0.7 resolver and rebuild values derived
from serialized JWK bytes, including thumbprints, cache keys, indexes, and
document hashes. Historical evidence whose proof input included the serialized
0.6 JWK must continue to be verified under the 0.6 representation profile.

Downstream consumers that decode Jubjub JWKs must support the 0.7 profile before
0.7 resolver producers are deployed. Resolver replicas must be upgraded
atomically enough to avoid returning different JWK strings for the same ledger
point.

## Alternatives considered

### Retain little-endian JWK coordinates

Rejected. It preserves 0.6 output but conflicts with the standard EC JWK
coordinate semantics and perpetuates an interoperability defect.

### Add an `endianness` JWK member

Rejected. JWK consumers may ignore unknown members, so a private marker cannot
change the meaning of standard `x` and `y` members or make the representation
safe for generic processing.

### Accept both byte orders or detect them heuristically

Rejected. The representation has no discriminator, both byte strings are valid
fixed-width integers, and validity-based selection can be ambiguous. Dual-read
behavior would create non-deterministic interpretation and downgrade paths.

### Change the MOD1 v1 wire encoding

Rejected. That would mutate existing long-form DID bytes and hashes. The
explicit conversion boundary preserves the immutable v1 format without
exposing its internal field strings as JWK values.

### Replace JWK with Multikey or a custom verification-method type

Deferred. A distinctly identified non-JWK representation could define its own
binary key format, but it requires a separate method profile, multicodec or key
header, implementation path, and coordinated downstream migration. It is not a
repair for existing `publicKeyJwk` output.

## Consequences

### Positive

- Jubjub `x` and `y` have the same fixed-width unsigned big-endian semantics as
  other EC JWK coordinates.
- One shared codec enforces canonical base64url, width, byte order, and field
  bounds.
- Native ledger points and historical MOD1 identifiers remain unchanged.
- Readers have one deterministic 0.7 representation and no downgrade heuristic.

### Negative

- Re-resolving a ledger-backed DID changes its serialized Jubjub JWK strings
  relative to 0.6.
- JWK thumbprints, JWK-derived identifiers, caches, indexes, document hashes,
  fixtures, and proofs over serialized JWK material may require migration or
  historical-profile verification.
- Producers and consumers require a coordinated 0.7 rollout.

### Limits

`Jubjub` remains an unregistered private JOSE curve name. Correct coordinate
semantics do not make it available in generic JOSE libraries and do not claim
IANA registration or broad JOSE interoperability. Point-on-curve, subgroup,
identity-key, and signature-canonicality hardening are separate cryptographic
validation decisions and are not defined by this encoding ADR.

## Implementation and migration references

- [Midnight DID method specification](../spec/midnight-method.md)
- [Migrating to 0.7](../guide/migrating-to-0.7.md)
- [Key Model](../guide/key-model.md)
- [`midnight-did-resolver#123`](https://github.com/midnightntwrk/midnight-did-resolver/issues/123)
- [`midnight-verifiable-credentials#660`](https://github.com/midnightntwrk/midnight-verifiable-credentials/issues/660)
