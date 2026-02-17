import { z } from "zod/v4-mini";

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const BASE64_LOOKUP: Record<string, number> = BASE64_ALPHABET.split("").reduce(
  (acc, char, index) => {
    acc[char] = index;
    return acc;
  },
  {} as Record<string, number>,
);

const encodeBase64 = (bytes: Uint8Array): string => {
  if (bytes.length === 0) return "";
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const byte1 = bytes[i] ?? 0;
    const byte2 = bytes[i + 1] ?? 0;
    const byte3 = bytes[i + 2] ?? 0;
    const hasByte2 = i + 1 < bytes.length;
    const hasByte3 = i + 2 < bytes.length;

    const chunk = (byte1 << 16) | (byte2 << 8) | byte3;
    output += BASE64_ALPHABET[(chunk >> 18) & 0x3f];
    output += BASE64_ALPHABET[(chunk >> 12) & 0x3f];
    output += hasByte2 ? BASE64_ALPHABET[(chunk >> 6) & 0x3f] : "=";
    output += hasByte3 ? BASE64_ALPHABET[chunk & 0x3f] : "=";
  }
  return output;
};

const decodeBase64 = (input: string): Uint8Array => {
  const clean = input.replace(/\s+/g, "");
  if (clean.length % 4 !== 0) throw new Error("Invalid base64 string length");

  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  const bytes = new Uint8Array((clean.length / 4) * 3 - padding);

  let byteIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const sextet = (char: string) => {
      if (char === "=") return 0;
      const value = BASE64_LOOKUP[char];
      if (value === undefined)
        throw new Error(`Invalid base64 character: ${char}`);
      return value;
    };

    const chunk =
      (sextet(clean[i]) << 18) |
      (sextet(clean[i + 1]) << 12) |
      (sextet(clean[i + 2]) << 6) |
      sextet(clean[i + 3]);

    bytes[byteIndex++] = (chunk >> 16) & 0xff;
    if (clean[i + 2] !== "=") bytes[byteIndex++] = (chunk >> 8) & 0xff;
    if (clean[i + 3] !== "=") bytes[byteIndex++] = chunk & 0xff;
  }

  return bytes;
};

const base64UrlEncode = (bytes: Uint8Array): string =>
  encodeBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const base64UrlDecode = (input: string): Uint8Array => {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (base64.length % 4 || 4)) % 4;
  return decodeBase64(base64 + "=".repeat(padding));
};

export const FieldCodec = z.codec(z.string(), z.bigint(), {
  decode: (s: string): bigint => {
    const bytes = base64UrlDecode(s);
    if (bytes.length === 0) return 0n;
    let v = 0n;
    for (const b of bytes) v = (v << 8n) + BigInt(b);
    return v;
  },
  encode: (v: bigint): string => {
    const toBytes = (x: bigint): Uint8Array => {
      if (x === 0n) return Uint8Array.of(0);
      const out: number[] = [];
      let t = x;
      while (t > 0n) {
        out.push(Number(t & 0xffn));
        t >>= 8n;
      }
      out.reverse();
      return Uint8Array.from(out);
    };
    return base64UrlEncode(toBytes(v));
  },
});
