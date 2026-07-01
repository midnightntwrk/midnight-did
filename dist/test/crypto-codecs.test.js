import * as base64js from "base64-js";
import { describe, expect, it } from "vitest";
import { z } from "zod/v4-mini";
import { decodeBase64UrlBytes32, FieldCodec } from "../crypto-codecs.js";
describe("FieldCodec (domain)", () => {
    const roundtrip = (v) => {
        const enc = z.encode(FieldCodec, v);
        const dec = z.decode(FieldCodec, enc);
        return { enc, dec };
    };
    it("encodes 0n as AA and roundtrips", () => {
        const { enc, dec } = roundtrip(0n);
        expect(enc).toBe("AA");
        expect(dec).toBe(0n);
    });
    it("matches known vectors", () => {
        const vec = [
            [1n, "AQ"],
            [2n, "Ag"],
            [255n, "_w"],
            [0x010203n, "AQID"],
        ];
        for (const [bi, b64] of vec) {
            expect(z.encode(FieldCodec, bi)).toBe(b64);
            expect(z.decode(FieldCodec, b64)).toBe(bi);
        }
    });
    it("aligns with base64-js encode/decode", () => {
        const values = [
            0n,
            1n,
            42n,
            255n,
            0xffeeddccbbaa99887766554433221100n,
            (1n << 255n) - 1n,
        ];
        const toBytes = (value) => {
            if (value === 0n)
                return Uint8Array.of(0);
            const bytes = [];
            let current = value;
            while (current > 0n) {
                bytes.push(Number(current & 0xffn));
                current >>= 8n;
            }
            bytes.reverse();
            return Uint8Array.from(bytes);
        };
        const fromBytes = (bytes) => {
            let result = 0n;
            for (const byte of bytes)
                result = (result << 8n) + BigInt(byte);
            return result;
        };
        const toBase64Url = (bytes) => base64js
            .fromByteArray(bytes)
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/g, "");
        const toBase64 = (base64url) => {
            const replaced = base64url.replace(/-/g, "+").replace(/_/g, "/");
            const padding = replaced.length % 4 === 0 ? 0 : 4 - (replaced.length % 4);
            return replaced + "=".repeat(padding);
        };
        for (const value of values) {
            const bytes = toBytes(value);
            const expected = toBase64Url(bytes);
            const ours = z.encode(FieldCodec, value);
            expect(ours).toBe(expected);
            const decoded = z.decode(FieldCodec, ours);
            expect(decoded).toBe(value);
            const libraryBytes = base64js.toByteArray(toBase64(ours));
            expect(fromBytes(libraryBytes)).toBe(value);
        }
    });
});
describe("decodeBase64UrlBytes32", () => {
    it("rejects non-canonical aliases with non-zero base64 pad bits", () => {
        expect(() => decodeBase64UrlBytes32("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB", "publicKeyJwk.x")).toThrow(/canonical unpadded base64url/);
    });
});
//# sourceMappingURL=crypto-codecs.test.js.map