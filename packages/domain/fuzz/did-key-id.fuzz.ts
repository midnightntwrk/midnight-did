import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { parseDIDKeyID } from "../src/did-document.js";

const fuzzRuns = Number.parseInt(process.env.FUZZ_RUNS ?? "100", 10);
const pathSegment = fc.stringMatching(/^[A-Za-z0-9._~-]{1,24}$/u);

describe("DID verification method identifier compatibility fuzz targets", () => {
  it("accepts historical path forms and their canonical DID URL rendering", () => {
    fc.assert(
      fc.property(pathSegment, (segment) => {
        expect(parseDIDKeyID(`/keys/${segment}`)).toBe(`/keys/${segment}`);
        expect(parseDIDKeyID(`./keys/${segment}`)).toBe(`./keys/${segment}`);
        expect(parseDIDKeyID(`did:example:subject/keys/${segment}`)).toBe(
          `did:example:subject/keys/${segment}`,
        );
      }),
      { numRuns: fuzzRuns },
    );
  });

  it("keeps unrelated reference forms rejected", () => {
    fc.assert(
      fc.property(pathSegment, (segment) => {
        expect(() => parseDIDKeyID(`//example.org/${segment}`)).toThrow();
        expect(() => parseDIDKeyID(`?key=${segment}`)).toThrow();
        expect(() => parseDIDKeyID(`keys/${segment}`)).toThrow();
      }),
      { numRuns: fuzzRuns },
    );
  });
});
