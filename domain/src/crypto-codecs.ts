import { Buffer } from "buffer";
import { z } from "zod/v4-mini";

export const FieldCodec = z.codec(
  z.string(),
  z.bigint(),
  {
    decode: (s: string): bigint => {
      const buf = Buffer.from(s, "base64url");
      if (buf.length === 0) return 0n;
      let v = 0n;
      for (const b of buf) v = (v << 8n) + BigInt(b);
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
      return Buffer.from(toBytes(v)).toString("base64url");
    }
  }
);

