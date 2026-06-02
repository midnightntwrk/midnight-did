import { describe, expect, it } from "vitest";

import {
  createVerificationMethod,
  CurveType,
  KeyType,
} from "../did-document.js";
import {
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

  it("rejects key material that is not exactly 32 bytes", () => {
    expect(() =>
      createVerificationMethod({
        ...exampleVerificationMethodInput,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          x: "AA",
        },
      }),
    ).toThrow(/32 bytes/);
  });
});
