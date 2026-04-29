export type MidnightCurve = "Ed25519" | "Jubjub" | "P-256";
export type MidnightKeyType = "OKP" | "EC";
export type SecretKeyRef = string;
export type {
  JubjubDigest as JubjubPayloadDigest,
  JubjubSchnorrSignature,
} from "@midnight-ntwrk/midnight-did-jubjub-schnorr";
export { JUBJUB_SIGNATURE_LENGTH_BYTES } from "@midnight-ntwrk/midnight-did-jubjub-schnorr";

export type PublicJwk = {
  kty: MidnightKeyType;
  crv: MidnightCurve;
  x: string;
  y?: string;
};

export type StoredKeyMeta = {
  id: string;
  keyRef: SecretKeyRef;
  did?: string;
  purpose?: string;
  createdAt: string;
  updatedAt: string;
  algorithm: {
    kty: MidnightKeyType;
    crv: MidnightCurve;
  };
};

export type GenerateKeyInput = {
  id: string;
  kty: MidnightKeyType;
  crv: MidnightCurve;
  did?: string;
  purpose?: string;
};

export type ImportKeyInput = {
  id: string;
  privateKey: Uint8Array;
  kty: MidnightKeyType;
  crv: MidnightCurve;
  did?: string;
  purpose?: string;
};

export type DeriveKeyFromSeedInput = {
  id: string;
  seedHex: string;
  kty: MidnightKeyType;
  crv: MidnightCurve;
  account?: number;
  index?: number;
  did?: string;
  purpose?: string;
};

export type VerifyInput = {
  keyRef?: SecretKeyRef;
  publicJwk?: PublicJwk;
  payload: Uint8Array;
  signature: Uint8Array;
};

export type SignOutput = {
  signature: Uint8Array;
  format: "raw";
};

export interface SecretStorage {
  initialize(params: { location: string; passphrase?: string }): Promise<void>;
  listKeys(filter?: { did?: string }): Promise<StoredKeyMeta[]>;
  generateKey(
    params: GenerateKeyInput,
  ): Promise<{ keyRef: SecretKeyRef; publicJwk: PublicJwk }>;
  importKey(
    params: ImportKeyInput,
  ): Promise<{ keyRef: SecretKeyRef; publicJwk: PublicJwk }>;
  deriveKeyFromSeed(
    params: DeriveKeyFromSeedInput,
  ): Promise<{ keyRef: SecretKeyRef; publicJwk: PublicJwk }>;
  getPublicKey(keyRef: SecretKeyRef): Promise<PublicJwk>;
  sign(input: {
    keyRef: SecretKeyRef;
    payload: Uint8Array;
  }): Promise<SignOutput>;
  verify(input: VerifyInput): Promise<boolean>;
  deleteKey(keyRef: SecretKeyRef): Promise<void>;
}
