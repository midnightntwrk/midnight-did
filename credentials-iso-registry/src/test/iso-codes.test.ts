import { describe, expect, it } from "vitest";

import { pureCircuits } from "../managed/iso-registry/contract/index.js";

describe("ISO code types and assertions", () => {
  it("constructs a CountryCode and passes equality assertion", () => {
    const germany = { value: 276n };
    expect(() => pureCircuits.assertCountryEquals(germany, 276n)).not.toThrow();
  });

  it("rejects mismatching country code", () => {
    const germany = { value: 276n };
    expect(() => pureCircuits.assertCountryEquals(germany, 840n)).toThrow(
      /Country code does not match/,
    );
  });

  it("constructs a RegionCode and passes country assertion", () => {
    const california = { country: 840n, subdivision: 6n };
    expect(() =>
      pureCircuits.assertRegionCountryEquals(california, 840n),
    ).not.toThrow();
  });

  it("rejects mismatching region country", () => {
    const california = { country: 840n, subdivision: 6n };
    expect(() =>
      pureCircuits.assertRegionCountryEquals(california, 276n),
    ).toThrow(/Region country does not match/);
  });

  it("constructs GenderCode with ISO 5218 values", () => {
    const male = { value: 1n };
    const female = { value: 2n };
    const notApplicable = { value: 9n };
    expect(male.value).toBe(1n);
    expect(female.value).toBe(2n);
    expect(notApplicable.value).toBe(9n);
  });
});
