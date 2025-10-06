import { describe, expect, it } from "vitest";

import { createVerificationMethod, CurveType, KeyType } from "../did-document";
import {
  exampleEcJsonWebKey,
  exampleJsonWebKey,
  exampleVerificationMethodInput,
} from "./fixtures/did";

describe("createVerificationMethod", () => {
  it("creates a valid verification method", () => {
    const vm = createVerificationMethod(exampleVerificationMethodInput);
    expect(vm.id).toBe(exampleVerificationMethodInput.id);
    expect(vm.publicKeyJwk).toEqual(exampleJsonWebKey);
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
          x: "AA",
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
});
