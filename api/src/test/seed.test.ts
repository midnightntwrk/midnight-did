import { describe, expect, it } from "vitest";

import { parseSeed } from "../seed";

describe("parseSeed", () => {
  it("normalizes valid seeds", () => {
    const parsed = parseSeed(
      "  ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789  ",
    );

    expect(parsed).toBe(
      "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    );
  });

  it("keeps the parsed seed suitable for wallet seed buffers", () => {
    const seed = "11".repeat(32);

    expect(Buffer.from(parseSeed(seed), "hex").toString("hex")).toBe(seed);
  });

  it("rejects non-hexadecimal seeds", () => {
    expect(() => parseSeed("zz")).toThrow(
      "Seed must contain only hexadecimal characters",
    );
  });

  it("rejects seeds with the wrong length", () => {
    expect(() => parseSeed("abcd")).toThrow(
      "Seed must be exactly 64 hex characters (32 bytes)",
    );
  });
});
