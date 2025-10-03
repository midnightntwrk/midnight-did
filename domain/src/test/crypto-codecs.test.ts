import { describe, expect, it } from "vitest";
import { z } from "zod/v4-mini";

import { FieldCodec } from "../crypto-codecs";

describe("FieldCodec (domain)", () => {
  const roundtrip = (v: bigint) => {
    const enc = z.encode(FieldCodec as any, v) as unknown as string;
    const dec = z.decode(FieldCodec as any, enc) as unknown as bigint;
    return { enc, dec };
  };

  it("encodes 0n as AA and roundtrips", () => {
    const { enc, dec } = roundtrip(0n);
    expect(enc).toBe("AA");
    expect(dec).toBe(0n);
  });

  it("matches known vectors", () => {
    const vec: Array<[bigint, string]> = [
      [1n, "AQ"],
      [2n, "Ag"],
      [255n, "_w"],
      [0x010203n, "AQID"],
    ];
    for (const [bi, b64] of vec) {
      expect(z.encode(FieldCodec as any, bi)).toBe(b64 as any);
      expect(z.decode(FieldCodec as any, b64) as any).toBe(bi as any);
    }
  });
});
