import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from "node:crypto";

import { maxField } from "@midnight-ntwrk/ledger-v8";
import {
  decodeJubjubSignature,
  deriveJubjubPublicKeyFromSeed,
  encodeJubjubSignature,
  signJubjubPayloadFromSeed,
  verifyJubjubPayload,
} from "@midnight-ntwrk/midnight-did-jubjub-schnorr";

import { UnsupportedCurveError } from "./errors.js";
import type { ImportKeyInput, MidnightCurve, PublicJwk } from "./types.js";

export type StoredPrivateRecord = {
  kty: "OKP" | "EC";
  crv: MidnightCurve;
  privateKey: string; // base64
  encoding: "pkcs8-der" | "raw32";
};

type LocalJsonWebKey = {
  kty?: string;
  crv?: string;
  x?: string;
  y?: string;
  d?: string;
};

const LEDGER_MAX_FIELD = maxField();

const base64urlToBuffer = (value: string): Buffer => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  const padded = pad === 0 ? normalized : `${normalized}${"=".repeat(4 - pad)}`;
  return Buffer.from(padded, "base64");
};

const ensure32Bytes = (value: Buffer): Buffer => {
  if (value.length === 32) return value;
  if (value.length > 32) return value.subarray(0, 32);
  return Buffer.concat([value, Buffer.alloc(32 - value.length)]);
};

const bufferToBase64url = (value: Buffer): string =>
  value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const bigintToBase64url = (value: bigint): string => {
  if (value === 0n) return "AA";
  let hex = value.toString(16);
  if (hex.length % 2 !== 0) hex = `0${hex}`;
  return bufferToBase64url(Buffer.from(hex, "hex"));
};

const bufferToBigint = (buf: Buffer): bigint => {
  if (buf.length === 0) return 0n;
  return BigInt(`0x${buf.toString("hex")}`);
};

const curveFromJwk = (jwk: LocalJsonWebKey): PublicJwk => {
  if (
    typeof jwk.kty !== "string" ||
    typeof jwk.crv !== "string" ||
    typeof jwk.x !== "string"
  ) {
    throw new UnsupportedCurveError("invalid-jwk");
  }
  return {
    kty: jwk.kty as "OKP" | "EC",
    crv: jwk.crv as MidnightCurve,
    x: jwk.x,
    y: typeof jwk.y === "string" ? jwk.y : undefined,
  };
};

const publicJwkToLedgerBigints = (
  publicJwk: PublicJwk,
): { x: bigint; y: bigint } => ({
  x: bufferToBigint(base64urlToBuffer(publicJwk.x)),
  y: publicJwk.y ? bufferToBigint(base64urlToBuffer(publicJwk.y)) : 0n,
});

export const isPublicJwkLedgerCompatible = (publicJwk: PublicJwk): boolean => {
  const { x, y } = publicJwkToLedgerBigints(publicJwk);
  return x >= 0n && x <= LEDGER_MAX_FIELD && y >= 0n && y <= LEDGER_MAX_FIELD;
};

const assertPublicJwkLedgerCompatible = (
  publicJwk: PublicJwk,
  context: string,
): void => {
  if (isPublicJwkLedgerCompatible(publicJwk)) {
    return;
  }
  throw new Error(
    `${context} is not representable in Midnight Compact fields; regenerate or derive another key`,
  );
};

const deriveJubjubPublic = async (
  privateKey: Buffer,
): Promise<{ x: bigint; y: bigint }> => {
  const normalized = ensure32Bytes(privateKey);
  return deriveJubjubPublicKeyFromSeed(normalized);
};

const createEd25519Pkcs8 = (privateKey: Buffer): Buffer => {
  const prefix = Buffer.from("302e020100300506032b657004220420", "hex");
  return Buffer.concat([prefix, privateKey]);
};

const createP256Pkcs8 = (privateKey: Buffer): Buffer => {
  const prefix = Buffer.from(
    "3041020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420",
    "hex",
  );
  return Buffer.concat([
    prefix,
    privateKey,
    Buffer.from("a00a06082a8648ce3d030107", "hex"),
  ]);
};

const createDerPrivateKey = (record: StoredPrivateRecord) =>
  createPrivateKey({
    key: Buffer.from(record.privateKey, "base64"),
    format: "der",
    type: "pkcs8",
  });

export const generateCurveKey = async (
  kty: "OKP" | "EC",
  crv: MidnightCurve,
): Promise<{ record: StoredPrivateRecord; publicJwk: PublicJwk }> => {
  if (kty === "OKP" && crv === "Ed25519") {
    for (let attempt = 0; attempt < 512; attempt += 1) {
      const pair = generateKeyPairSync("ed25519");
      const privateDer = pair.privateKey.export({
        type: "pkcs8",
        format: "der",
      }) as Buffer;
      const publicJwk = curveFromJwk(
        pair.publicKey.export({ format: "jwk" }) as LocalJsonWebKey,
      );
      if (!isPublicJwkLedgerCompatible(publicJwk)) {
        continue;
      }
      return {
        record: {
          kty,
          crv,
          privateKey: privateDer.toString("base64"),
          encoding: "pkcs8-der",
        },
        publicJwk,
      };
    }
    throw new Error(
      "Failed to generate a ledger-compatible Ed25519 public key",
    );
  }
  if (kty === "EC" && crv === "P-256") {
    for (let attempt = 0; attempt < 512; attempt += 1) {
      const pair = generateKeyPairSync("ec", { namedCurve: "P-256" });
      const privateDer = pair.privateKey.export({
        type: "pkcs8",
        format: "der",
      }) as Buffer;
      const publicJwk = curveFromJwk(
        pair.publicKey.export({ format: "jwk" }) as LocalJsonWebKey,
      );
      if (!isPublicJwkLedgerCompatible(publicJwk)) {
        continue;
      }
      return {
        record: {
          kty,
          crv,
          privateKey: privateDer.toString("base64"),
          encoding: "pkcs8-der",
        },
        publicJwk,
      };
    }
    throw new Error("Failed to generate a ledger-compatible P-256 public key");
  }
  if (kty === "EC" && crv === "Jubjub") {
    const privateKey = generateKeyPairSync("ed25519").privateKey.export({
      format: "jwk",
    }) as LocalJsonWebKey;
    const seed =
      typeof privateKey.d === "string"
        ? base64urlToBuffer(privateKey.d)
        : Buffer.alloc(32, 1);
    const pub = await deriveJubjubPublic(seed);
    const publicJwk = {
      kty,
      crv,
      x: bigintToBase64url(pub.x),
      y: bigintToBase64url(pub.y),
    };
    assertPublicJwkLedgerCompatible(publicJwk, "Generated Jubjub public key");
    return {
      record: {
        kty,
        crv,
        privateKey: seed.toString("base64"),
        encoding: "raw32",
      },
      publicJwk,
    };
  }
  throw new UnsupportedCurveError(`${kty}/${crv}`);
};

export const importCurveKey = async (
  params: Pick<ImportKeyInput, "kty" | "crv" | "privateKey">,
): Promise<{ record: StoredPrivateRecord; publicJwk: PublicJwk }> => {
  const keyBuf = Buffer.from(params.privateKey);
  if (params.kty === "OKP" && params.crv === "Ed25519") {
    const privateDer =
      keyBuf.length === 32 ? createEd25519Pkcs8(keyBuf) : keyBuf;
    const privateKey = createPrivateKey({
      key: privateDer,
      format: "der",
      type: "pkcs8",
    });
    const publicJwk = curveFromJwk(
      createPublicKey(privateKey).export({ format: "jwk" }) as LocalJsonWebKey,
    );
    const result: { record: StoredPrivateRecord; publicJwk: PublicJwk } = {
      record: {
        kty: params.kty,
        crv: params.crv,
        privateKey: privateDer.toString("base64"),
        encoding: "pkcs8-der",
      },
      publicJwk,
    };
    assertPublicJwkLedgerCompatible(
      result.publicJwk,
      "Imported Ed25519 public key",
    );
    return result;
  }
  if (params.kty === "EC" && params.crv === "P-256") {
    const privateDer = keyBuf.length === 32 ? createP256Pkcs8(keyBuf) : keyBuf;
    const privateKey = createPrivateKey({
      key: privateDer,
      format: "der",
      type: "pkcs8",
    });
    const publicJwk = curveFromJwk(
      createPublicKey(privateKey).export({ format: "jwk" }) as LocalJsonWebKey,
    );
    const result: { record: StoredPrivateRecord; publicJwk: PublicJwk } = {
      record: {
        kty: params.kty,
        crv: params.crv,
        privateKey: privateDer.toString("base64"),
        encoding: "pkcs8-der",
      },
      publicJwk,
    };
    assertPublicJwkLedgerCompatible(
      result.publicJwk,
      "Imported P-256 public key",
    );
    return result;
  }
  if (params.kty === "EC" && params.crv === "Jubjub") {
    const raw = keyBuf.length > 32 ? keyBuf.subarray(0, 32) : keyBuf;
    const normalized = ensure32Bytes(raw);
    const pub = await deriveJubjubPublic(normalized);
    const result: { record: StoredPrivateRecord; publicJwk: PublicJwk } = {
      record: {
        kty: params.kty,
        crv: params.crv,
        privateKey: normalized.toString("base64"),
        encoding: "raw32",
      },
      publicJwk: {
        kty: params.kty,
        crv: params.crv,
        x: bigintToBase64url(pub.x),
        y: bigintToBase64url(pub.y),
      },
    };
    assertPublicJwkLedgerCompatible(
      result.publicJwk,
      "Imported Jubjub public key",
    );
    return result;
  }
  throw new UnsupportedCurveError(`${params.kty}/${params.crv}`);
};

export const signWithCurveKey = async (
  record: StoredPrivateRecord,
  payload: Uint8Array,
): Promise<Uint8Array> => {
  if (record.kty === "OKP" && record.crv === "Ed25519") {
    return sign(null, Buffer.from(payload), createDerPrivateKey(record));
  }
  if (record.kty === "EC" && record.crv === "P-256") {
    return sign("sha256", Buffer.from(payload), createDerPrivateKey(record));
  }
  if (record.kty === "EC" && record.crv === "Jubjub") {
    const privateKeyBytes = ensure32Bytes(
      Buffer.from(record.privateKey, "base64"),
    );
    return encodeJubjubSignature(
      signJubjubPayloadFromSeed(privateKeyBytes, payload),
    );
  }
  throw new UnsupportedCurveError(`${record.kty}/${record.crv}`);
};

export const verifyWithPublicJwk = async (
  publicJwk: PublicJwk,
  payload: Uint8Array,
  signature: Uint8Array,
): Promise<boolean> => {
  if (publicJwk.kty === "OKP" && publicJwk.crv === "Ed25519") {
    const key = createPublicKey({
      key: publicJwk as LocalJsonWebKey,
      format: "jwk",
    });
    return verify(null, Buffer.from(payload), key, Buffer.from(signature));
  }
  if (publicJwk.kty === "EC" && publicJwk.crv === "P-256") {
    const key = createPublicKey({
      key: publicJwk as LocalJsonWebKey,
      format: "jwk",
    });
    return verify("sha256", Buffer.from(payload), key, Buffer.from(signature));
  }
  if (publicJwk.kty === "EC" && publicJwk.crv === "Jubjub") {
    if (!publicJwk.y) {
      throw new UnsupportedCurveError("EC/Jubjub missing y coordinate");
    }

    const publicKey = {
      x: bufferToBigint(base64urlToBuffer(publicJwk.x)),
      y: bufferToBigint(base64urlToBuffer(publicJwk.y)),
    };

    return verifyJubjubPayload(
      publicKey,
      payload,
      decodeJubjubSignature(signature),
    );
  }
  throw new UnsupportedCurveError(`${publicJwk.kty}/${publicJwk.crv}`);
};

export const normalizePublicForLedger = (
  publicJwk: PublicJwk,
): { kty: "EC" | "OKP"; crv: MidnightCurve; x: bigint; y: bigint } => {
  assertPublicJwkLedgerCompatible(publicJwk, "Public key");
  const { x, y } = publicJwkToLedgerBigints(publicJwk);
  return {
    kty: publicJwk.kty,
    crv: publicJwk.crv,
    x,
    y,
  };
};
