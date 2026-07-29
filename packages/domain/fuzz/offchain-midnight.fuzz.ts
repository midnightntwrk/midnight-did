import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { CurveType, KeyType } from "../src/did-document.js";
import {
  decodeOffchainMidnightDIDState,
  encodeOffchainMidnightDIDState,
  OFFCHAIN_STATE_ENCODING,
  parseLongFormOffchainMidnightDIDString,
  type OffchainMidnightDIDState,
} from "../src/offchain-midnight.js";

const fuzzRuns = Number.parseInt(process.env.FUZZ_RUNS ?? "100", 10);

const bytesBase64Url = (length: number) =>
  fc
    .uint8Array({ minLength: length, maxLength: length })
    .map((bytes) => Buffer.from(bytes).toString("base64url"));

const fragmentArbitrary = fc
  .stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789-_"), {
    minLength: 1,
    maxLength: 24,
  })
  .map((value) => `#${value}`);

const uriArbitrary = fc.webUrl({ validSchemes: ["https"] });

const relationshipsArbitrary = fc.record({
  authentication: fc.boolean(),
  assertionMethod: fc.boolean(),
  keyAgreement: fc.boolean(),
  capabilityInvocation: fc.boolean(),
  capabilityDelegation: fc.boolean(),
});

const jwkArbitrary = fc.oneof(
  fc.record({
    kty: fc.constant(KeyType.OKP),
    crv: fc.constant(CurveType.Ed25519),
    x: bytesBase64Url(32),
  }),
  fc.record({
    kty: fc.constant(KeyType.OKP),
    crv: fc.constant(CurveType.X25519),
    x: bytesBase64Url(32),
  }),
  fc.record({
    kty: fc.constant(KeyType.OKP),
    crv: fc.constant(CurveType.BLS12381G1),
    x: bytesBase64Url(48),
  }),
  fc.record({
    kty: fc.constant(KeyType.OKP),
    crv: fc.constant(CurveType.BLS12381G2),
    x: bytesBase64Url(96),
  }),
  fc.record({
    kty: fc.constant(KeyType.EC),
    crv: fc.constantFrom(CurveType.Jubjub, CurveType.P256, CurveType.Secp256k1),
    x: bytesBase64Url(32),
    y: bytesBase64Url(32),
  }),
);

const offchainStateArbitrary: fc.Arbitrary<OffchainMidnightDIDState> =
  fc.record(
    {
      version: fc.integer({ min: 1, max: 65535 }),
      alsoKnownAs: fc.array(uriArbitrary, { minLength: 0, maxLength: 4 }),
      verificationMethod: fc.array(
        fc.record({
          id: fragmentArbitrary,
          publicKeyJwk: jwkArbitrary,
          relationships: relationshipsArbitrary,
        }),
        { minLength: 1, maxLength: 4 },
      ),
      service: fc.array(
        fc.record({
          id: fragmentArbitrary,
          type: fc.string({ minLength: 1, maxLength: 32 }),
          serviceEndpoint: uriArbitrary,
        }),
        { minLength: 0, maxLength: 4 },
      ),
    },
    {
      requiredKeys: ["version", "alsoKnownAs", "verificationMethod", "service"],
    },
  );

const malformedPayloadArbitrary = fc.oneof(
  fc.string({ minLength: 0, maxLength: 128 }),
  fc
    .uint8Array({ minLength: 0, maxLength: 128 })
    .map((bytes) => Buffer.from(bytes).toString("base64url")),
);

describe("offchain Midnight DID fuzz targets", () => {
  it("round-trips generated offchain states through the portable encoding", () => {
    fc.assert(
      fc.property(offchainStateArbitrary, (state) => {
        const encoded = encodeOffchainMidnightDIDState(state);
        expect(encoded.encoding).toBe(OFFCHAIN_STATE_ENCODING);
        expect(decodeOffchainMidnightDIDState(encoded)).toEqual(state);
      }),
      { numRuns: fuzzRuns },
    );
  });

  it("rejects malformed encoded states without uncaught non-Error crashes", () => {
    fc.assert(
      fc.property(malformedPayloadArbitrary, (payload) => {
        try {
          decodeOffchainMidnightDIDState({
            encoding: OFFCHAIN_STATE_ENCODING,
            payload,
          });
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }),
      { numRuns: fuzzRuns },
    );
  });

  it("rejects malformed long-form DID payloads without accepting mismatched hashes", () => {
    fc.assert(
      fc.property(malformedPayloadArbitrary, (payload) => {
        const candidate = `did:midnight:offchain:${"0".repeat(64)}:${payload}`;
        try {
          const parsed = parseLongFormOffchainMidnightDIDString(candidate);
          expect(parsed.stateHash).not.toBe("0".repeat(64));
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }),
      { numRuns: fuzzRuns },
    );
  });
});
