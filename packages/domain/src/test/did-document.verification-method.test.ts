import { describe, expect, it } from "vitest";

import {
  createVerificationMethod,
  CurveType,
  KeyType,
} from "../did-document.js";
import {
  exampleBls12381G1JsonWebKey,
  exampleBls12381G2JsonWebKey,
  exampleEcJsonWebKey,
  exampleJsonWebKey,
  exampleP256JsonWebKey,
  exampleRelativeVerificationMethodInput,
  exampleSecp256k1JsonWebKey,
  exampleVerificationMethodInput,
  exampleX25519JsonWebKey,
} from "./fixtures/did.js";

describe("createVerificationMethod", () => {
  const bytes32Zero = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

  it("creates a valid verification method", () => {
    const vm = createVerificationMethod(exampleVerificationMethodInput);
    expect(vm.id).toBe(exampleVerificationMethodInput.id);
    expect(vm.publicKeyJwk).toEqual(exampleJsonWebKey);
  });

  it("creates a valid verification method with relative id", () => {
    const vm = createVerificationMethod(exampleRelativeVerificationMethodInput);
    expect(vm.id).toBe(exampleRelativeVerificationMethodInput.id);
  });

  it("rejects OKP keys that include a y coordinate", () => {
    expect(() =>
      createVerificationMethod({
        ...exampleVerificationMethodInput,
        publicKeyJwk: { ...exampleJsonWebKey, y: "AA" },
      }),
    ).toThrow(/must not include a y coordinate/);
  });

  it("rejects public JWKs that include private key material", () => {
    expect(() =>
      createVerificationMethod({
        ...exampleVerificationMethodInput,
        publicKeyJwk: { ...exampleJsonWebKey, d: bytes32Zero },
      }),
    ).toThrow(/private key material/);
  });

  it("rejects non-OKP keys that omit a y coordinate", () => {
    expect(() =>
      createVerificationMethod({
        ...exampleVerificationMethodInput,
        publicKeyJwk: {
          kty: KeyType.EC,
          crv: CurveType.Jubjub,
          x: bytes32Zero,
        },
      }),
    ).toThrow();
  });

  it("accepts EC keys that provide y coordinate", () => {
    const vm = createVerificationMethod({
      ...exampleVerificationMethodInput,
      id: `${exampleVerificationMethodInput.controller}#key-ec`,
      publicKeyJwk: exampleEcJsonWebKey,
    });
    expect(vm.publicKeyJwk).toEqual(exampleEcJsonWebKey);
  });

  it("accepts P-256 EC keys", () => {
    const vm = createVerificationMethod({
      ...exampleVerificationMethodInput,
      id: `${exampleVerificationMethodInput.controller}#key-p256`,
      publicKeyJwk: exampleP256JsonWebKey,
    });
    expect(vm.publicKeyJwk).toEqual(exampleP256JsonWebKey);
  });

  it("accepts X25519 OKP keys", () => {
    const vm = createVerificationMethod({
      ...exampleVerificationMethodInput,
      id: `${exampleVerificationMethodInput.controller}#key-x25519`,
      publicKeyJwk: exampleX25519JsonWebKey,
    });
    expect(vm.publicKeyJwk).toEqual(exampleX25519JsonWebKey);
  });

  it("accepts secp256k1 EC keys", () => {
    const vm = createVerificationMethod({
      ...exampleVerificationMethodInput,
      id: `${exampleVerificationMethodInput.controller}#key-secp256k1`,
      publicKeyJwk: exampleSecp256k1JsonWebKey,
    });
    expect(vm.publicKeyJwk).toEqual(exampleSecp256k1JsonWebKey);
  });

  it("accepts BLS12-381 OKP compressed point keys", () => {
    for (const [id, publicKeyJwk] of [
      ["key-bls12381-g1", exampleBls12381G1JsonWebKey],
      ["key-bls12381-g2", exampleBls12381G2JsonWebKey],
    ] as const) {
      const vm = createVerificationMethod({
        ...exampleVerificationMethodInput,
        id: `${exampleVerificationMethodInput.controller}#${id}`,
        publicKeyJwk,
      });
      expect(vm.publicKeyJwk).toEqual(publicKeyJwk);
      expect("y" in vm.publicKeyJwk).toBe(false);
    }
  });

  it("rejects key material that is not the supported curve length", () => {
    expect(() =>
      createVerificationMethod({
        ...exampleVerificationMethodInput,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          x: "AA",
        },
      }),
    ).toThrow(/supported curve length/);
  });

  it("rejects BLS12-381 keys with the wrong compressed point length or y coordinate", () => {
    expect(() =>
      createVerificationMethod({
        ...exampleVerificationMethodInput,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.BLS12381G1,
          x: bytes32Zero,
        },
      }),
    ).toThrow(/supported curve length/);

    expect(() =>
      createVerificationMethod({
        ...exampleVerificationMethodInput,
        publicKeyJwk: {
          ...exampleBls12381G2JsonWebKey,
          y: bytes32Zero,
        },
      }),
    ).toThrow(/must not include a y coordinate/);
  });
});
