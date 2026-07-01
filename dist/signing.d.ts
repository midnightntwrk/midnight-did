import { type JubjubPoint } from "@midnight-ntwrk/compact-runtime";
export type JubjubDigest = [bigint, bigint, bigint, bigint];
export type JubjubSchnorrSignature = {
    announcement: JubjubPoint;
    response: bigint;
};
export declare const JUBJUB_ORDER = 6554484396890773809930967563523245729705921265872317281365359162392183254199n;
export declare const TWO_248 = 452312848583266388373324160190187140051835877600158453279131187530910662656n;
export declare const JUBJUB_SIGNATURE_LENGTH_BYTES = 96;
export declare const normalizeScalar: (value: bigint) => bigint;
export declare const seedBytesToJubjubSecretScalar: (seedBytes: Uint8Array) => bigint;
export declare const deriveJubjubPublicKey: (secretScalar: bigint) => JubjubPoint;
export declare const deriveJubjubPublicKeyFromSeed: (seedBytes: Uint8Array) => JubjubPoint;
export declare const payloadToJubjubDigest: (payload: Uint8Array) => JubjubDigest;
export declare const encodeJubjubSignature: (signature: JubjubSchnorrSignature) => Uint8Array;
export declare const decodeJubjubSignature: (signature: Uint8Array) => JubjubSchnorrSignature;
export declare const computeJubjubDigestChallenge: (announcement: JubjubPoint, publicKey: JubjubPoint, digest: JubjubDigest) => bigint;
export declare const signJubjubDigest: (secretScalar: bigint, digest: JubjubDigest, nonceSeed?: Uint8Array) => JubjubSchnorrSignature;
export declare const signJubjubDigestFromSeed: (seedBytes: Uint8Array, digest: JubjubDigest) => JubjubSchnorrSignature;
export declare const signJubjubPayloadFromSeed: (seedBytes: Uint8Array, payload: Uint8Array) => JubjubSchnorrSignature;
export declare const verifyJubjubDigest: (publicKey: JubjubPoint, digest: JubjubDigest, signature: JubjubSchnorrSignature) => boolean;
export declare const verifyJubjubPayload: (publicKey: JubjubPoint, payload: Uint8Array, signature: JubjubSchnorrSignature) => boolean;
//# sourceMappingURL=signing.d.ts.map