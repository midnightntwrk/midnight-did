import * as base64js from "base64-js";
import { describe, expect, it } from "vitest";
import { z } from "zod/v4-mini";

import {
  decodeBase64UrlBytes,
  decodeBase64UrlBytes32,
  decodeJubjubJwkCoordinate,
  encodeJubjubJwkCoordinate,
  FieldCodec,
} from "../crypto-codecs.js";

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

  it("aligns with base64-js encode/decode", () => {
    const values: bigint[] = [
      0n,
      1n,
      42n,
      255n,
      0xffeeddccbbaa99887766554433221100n,
      (1n << 255n) - 1n,
    ];

    const toBytes = (value: bigint): Uint8Array => {
      if (value === 0n) return Uint8Array.of(0);
      const bytes: number[] = [];
      let current = value;
      while (current > 0n) {
        bytes.push(Number(current & 0xffn));
        current >>= 8n;
      }
      bytes.reverse();
      return Uint8Array.from(bytes);
    };

    const fromBytes = (bytes: Uint8Array): bigint => {
      let result = 0n;
      for (const byte of bytes) result = (result << 8n) + BigInt(byte);
      return result;
    };

    const toBase64Url = (bytes: Uint8Array): string =>
      base64js
        .fromByteArray(bytes)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");

    const toBase64 = (base64url: string): string => {
      const replaced = base64url.replace(/-/g, "+").replace(/_/g, "/");
      const padding = replaced.length % 4 === 0 ? 0 : 4 - (replaced.length % 4);
      return replaced + "=".repeat(padding);
    };

    for (const value of values) {
      const bytes = toBytes(value);
      const expected = toBase64Url(bytes);
      const ours = z.encode(FieldCodec as any, value) as unknown as string;
      expect(ours).toBe(expected);

      const decoded = z.decode(FieldCodec as any, ours) as unknown as bigint;
      expect(decoded).toBe(value);

      const libraryBytes = base64js.toByteArray(toBase64(ours));
      expect(fromBytes(libraryBytes)).toBe(value);
    }
  });
});

describe("Jubjub JWK coordinate codec", () => {
  const vectors: Array<[bigint, string]> = [
    [0n, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"],
    [1n, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAE"],
    [256n, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQA"],
    [0x010203n, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAgM"],
    [
      52435875175126190479447740508185965837690552500527637822603658699938581184512n,
      "c-2nUymdfUgzOdgICaHYBVO9pAL__lv-_____wAAAAA",
    ],
  ];

  it.each(vectors)(
    "encodes %s as an unsigned fixed-width big-endian coordinate",
    (value, encoded) => {
      expect(encodeJubjubJwkCoordinate(value)).toBe(encoded);
      expect(decodeJubjubJwkCoordinate(encoded)).toBe(value);
    },
  );

  it("retains leading zero bytes instead of using the minimal field encoding", () => {
    const encoded = encodeJubjubJwkCoordinate(0x010203n);

    expect(encoded).toHaveLength(43);
    expect(encoded).not.toBe("AQID");
  });

  it.each([
    [-1n, /must be non-negative/],
    [
      52435875175126190479447740508185965837690552500527637822603658699938581184513n,
      /less than the Jubjub base field modulus/,
    ],
    [1n << 256n, /less than the Jubjub base field modulus/],
  ] as const)("rejects an out-of-range value %s", (value, error) => {
    expect(() => encodeJubjubJwkCoordinate(value)).toThrow(error);
  });

  it("rejects non-canonical or wrong-length coordinate strings", () => {
    const encoded = encodeJubjubJwkCoordinate(1n);
    const bytes31 = base64js
      .fromByteArray(new Uint8Array(31))
      .replace(/=+$/g, "");
    const bytes33 = base64js
      .fromByteArray(new Uint8Array(33))
      .replace(/=+$/g, "");

    expect(() => decodeJubjubJwkCoordinate("AA")).toThrow(/exactly 32 bytes/);
    expect(() => decodeJubjubJwkCoordinate(bytes31)).toThrow(
      /exactly 32 bytes/,
    );
    expect(() => decodeJubjubJwkCoordinate(bytes33)).toThrow(
      /exactly 32 bytes/,
    );
    expect(() => decodeJubjubJwkCoordinate(`${encoded}=`)).toThrow(
      /canonical unpadded base64url/,
    );
    expect(() => decodeJubjubJwkCoordinate(` ${encoded}`)).toThrow(
      /canonical unpadded base64url/,
    );
    expect(() =>
      decodeJubjubJwkCoordinate("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB"),
    ).toThrow(/canonical unpadded base64url/);
    expect(() =>
      decodeJubjubJwkCoordinate("c-2nUymdfUgzOdgICaHYBVO9pAL__lv-_____wAAAAE"),
    ).toThrow(/less than the Jubjub base field modulus/);
    expect(() =>
      decodeJubjubJwkCoordinate("__________________________________________8"),
    ).toThrow(/less than the Jubjub base field modulus/);
  });
});

describe("decodeBase64UrlBytes32", () => {
  it("rejects non-canonical aliases with non-zero base64 pad bits", () => {
    expect(() =>
      decodeBase64UrlBytes32(
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB",
        "publicKeyJwk.x",
      ),
    ).toThrow(/canonical unpadded base64url/);
  });
});

describe("decodeBase64UrlBytes", () => {
  it("validates arbitrary expected byte lengths", () => {
    const bytes48 =
      "BgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYG";
    expect(decodeBase64UrlBytes(bytes48, 48, "publicKeyJwk.x")).toHaveLength(
      48,
    );
    expect(() => decodeBase64UrlBytes(bytes48, 32, "publicKeyJwk.x")).toThrow(
      /exactly 32 bytes/,
    );
  });
});
