import { hkdfSync } from "node:crypto";

import { HDWallet, Roles } from "@midnight-ntwrk/wallet-sdk-hd";

import { UnsupportedCurveError } from "./errors";
import type { DeriveKeyFromSeedInput, ImportKeyInput } from "./types";

const P256_ORDER = BigInt(
  "0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551",
);

const HKDF_SALT = Buffer.from("midnight-did-secret-storage-v1", "utf8");

const assertHexSeed = (seedHex: string): Buffer => {
  const normalized = seedHex.trim().toLowerCase();
  if (!/^[0-9a-f]+$/u.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error("seedHex must be a valid even-length hex string");
  }
  return Buffer.from(normalized, "hex");
};

const bigintTo32Be = (value: bigint): Buffer => {
  const hex = value.toString(16).padStart(64, "0");
  return Buffer.from(hex, "hex");
};

const normalizeP256Private = (privateKey: Buffer): Buffer => {
  const asInt = BigInt(`0x${privateKey.toString("hex")}`);
  const normalized = (asInt % (P256_ORDER - 1n)) + 1n;
  return bigintTo32Be(normalized);
};

const deriveMetadataKey = (
  seedHex: string,
  account: number,
  index: number,
): Uint8Array => {
  const hdWalletResult = HDWallet.fromSeed(assertHexSeed(seedHex));
  if (hdWalletResult.type !== "seedOk") {
    throw new Error("Failed to initialize HD wallet from seed");
  }

  const derivationResult = hdWalletResult.hdWallet
    .selectAccount(account)
    .selectRole(Roles.Metadata)
    .deriveKeyAt(index);

  hdWalletResult.hdWallet.clear();

  if (derivationResult.type !== "keyDerived") {
    throw new Error("Failed to derive metadata key from seed");
  }

  return derivationResult.key;
};

export const deriveCurvePrivateFromSeed = (
  params: DeriveKeyFromSeedInput,
): Pick<ImportKeyInput, "privateKey" | "kty" | "crv"> => {
  const account = params.account ?? 0;
  const index = params.index ?? 0;
  if (account < 0 || index < 0) {
    throw new Error("account and index must be non-negative integers");
  }

  const metadataKey = deriveMetadataKey(params.seedHex, account, index);
  const info = Buffer.from(
    `midnight-did:key:v1:${params.kty}:${params.crv}:${account}:${index}`,
    "utf8",
  );
  const derived = Buffer.from(
    hkdfSync("sha256", Buffer.from(metadataKey), HKDF_SALT, info, 32),
  );

  if (params.kty === "OKP" && params.crv === "Ed25519") {
    return {
      kty: params.kty,
      crv: params.crv,
      privateKey: new Uint8Array(derived),
    };
  }

  if (params.kty === "EC" && params.crv === "Jubjub") {
    return {
      kty: params.kty,
      crv: params.crv,
      privateKey: new Uint8Array(derived),
    };
  }

  if (params.kty === "EC" && params.crv === "P-256") {
    return {
      kty: params.kty,
      crv: params.crv,
      privateKey: new Uint8Array(normalizeP256Private(derived)),
    };
  }

  throw new UnsupportedCurveError(`${params.kty}/${params.crv}`);
};
