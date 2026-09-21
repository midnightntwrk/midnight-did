# Migrating to 0.7

Midnight DID 0.7 changes the DID Document transport encoding of native
SchnorrJubjub public-key coordinates. Version 0.6 encoded each coordinate as 32
little-endian bytes. Version 0.7 follows the RFC 7518 EC JWK convention: each
`x` and `y` value is canonical unpadded base64url containing exactly 32
unsigned **big-endian** bytes.

For example:

| Coordinate | 0.6 little-endian JWK value                   | 0.7 big-endian JWK value                      |
| ---------- | --------------------------------------------- | --------------------------------------------- |
| `1`        | `AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` | `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAE` |
| `256`      | `AAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` | `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQA` |

`crv: "Jubjub"` remains a Midnight-private, unregistered JOSE curve name.
Correcting the coordinate byte order does not make the curve available in
generic JOSE libraries.

## Ledger-backed DIDs

No ledger or contract-state migration is required. The ledger continues to
store the same native `JubjubPoint`, and DID identifiers, verification-method
identifiers, relationships, signatures, and Schnorr arithmetic are unchanged.
Re-resolving an existing ledger-backed DID with a 0.7 resolver produces the
canonical big-endian JWK representation of that same point.

Upgrade every resolver replica together. Mixed 0.6 and 0.7 replicas can return
different JWK strings for the same ledger state.

## Persisted documents and derived identifiers

A persisted 0.6 DID Document contains unmarked little-endian Jubjub JWK
coordinates. Do not reinterpret that snapshot with the 0.7 codec and do not try
both byte orders heuristically. Instead:

1. Re-resolve the DID from authoritative ledger state with a 0.7 resolver.
2. Replace cached DID Documents with the newly resolved representation.
3. Rebuild RFC 7638 JWK thumbprints, JWK-derived `kid` values, database indexes,
   equality keys, and document hashes that include the serialized JWK.
4. Verify historical evidence with the representation and software profile
   under which it was created when exact document bytes were part of the proof.

Use `encodeJubjubJwkCoordinate` and `decodeJubjubJwkCoordinate` from
`@midnight-ntwrk/midnight-did-domain` for new 0.7 integration code. The decoder
requires canonical unpadded base64url, exactly 32 bytes, and a value below the
Jubjub base-field modulus. It does not guess a legacy byte order.

## Offchain DIDs

The `midnight-offchain-did-state-v1.base64url` (`MOD1`) wire format and existing
DID hashes are unchanged. Its historical `keyKind = 1` payload stores Jubjub
coordinates as fixed-width little-endian strings. In 0.7, the offchain codec
converts those internal strings to canonical big-endian JWK values when decoding
and converts canonical JWK input back to the legacy wire order when encoding.

Existing long-form DIDs therefore retain their exact identifier and resolve to
the same mathematical public key, now exposed through the canonical 0.7 JWK
representation. New callers must supply big-endian JWK values to the domain API;
they must not pre-reverse values for MOD1. The internal legacy string is an
offchain wire-format field, not a JWK that consumers should use directly.

## Coordinated downstream rollout

Any consumer that converts a resolved Jubjub JWK back to a native point must be
upgraded before 0.7 resolver output is enabled. This includes resolver-side key
custody adapters, credential bindings, application fixtures, and test vectors.
Deploy consumers that understand the 0.7 profile first, then upgrade resolver
producers. Do not add an unmarked dual-read fallback.

See [ADR: Jubjub JWK Coordinate Encoding](../architecture/adr-jubjub-jwk-coordinate-encoding.md)
for the decision record and [Key Model](./key-model.md) for the current storage
and verification paths.
