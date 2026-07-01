import { z } from "zod/v4-mini";
export declare const encodeBase64Url: (bytes: Uint8Array) => string;
export declare const decodeBase64Url: (input: string) => Uint8Array;
export declare const decodeBase64UrlBytes32: (input: string, label?: string) => Uint8Array;
export declare const decodeFieldElement: (s: string) => bigint;
export declare const encodeFieldElement: (v: bigint) => string;
export declare const FieldCodec: z.ZodMiniCodec<z.ZodMiniString<string>, z.ZodMiniBigInt<bigint>>;
//# sourceMappingURL=crypto-codecs.d.ts.map