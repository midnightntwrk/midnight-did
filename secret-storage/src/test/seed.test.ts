import { describe, expect, it } from "vitest";

import { parseSeed, SeedSchema, seedToBuffer } from "../seed.js";

describe("SeedSchema", () => {
  it("normalizes valid seeds", () => {
    const parsed = parseSeed(
      "  ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789  ",
    );
    expect(parsed).toBe(
      "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    );
  });

  it("rejects malformed seeds", () => {
    expect(() => parseSeed("zz")).toThrow(
      "Seed must contain only hexadecimal characters",
    );
    expect(() => parseSeed("abcd")).toThrow(
      "Seed must be exactly 64 hex characters (32 bytes)",
    );
  });

  it("converts valid seeds to buffers", () => {
    expect(seedToBuffer("11".repeat(32)).toString("hex")).toBe("11".repeat(32));
  });

  it("is re-exported as a zod schema", () => {
    expect(SeedSchema.safeParse("22".repeat(32)).success).toBe(true);
  });
});
