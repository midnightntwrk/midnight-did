import { SigningNotSupportedError, UnsupportedCurveError } from "./errors.js";
import type {
  DeriveKeyFromSeedInput,
  GenerateKeyInput,
  ImportKeyInput,
  PublicJwk,
  SecretStorage,
  StoredKeyMeta,
  VerifyInput,
} from "./types.js";

export type VeramoLikeAgent = {
  keyManagerCreate?: (
    args: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  keyManagerImport?: (
    args: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  keyManagerGet?: (
    args: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  keyManagerSign?: (
    args: Record<string, unknown>,
  ) => Promise<{ signature: string } | Record<string, unknown>>;
};

const mapCurve = (curve: string): string => {
  if (curve === "Ed25519") return "Ed25519";
  if (curve === "P-256") return "Secp256r1";
  if (curve === "Jubjub") return "Jubjub";
  throw new UnsupportedCurveError(curve);
};

export class VeramoSecretStore implements SecretStorage {
  private agent: VeramoLikeAgent;
  private initialized = false;
  private meta = new Map<string, StoredKeyMeta>();

  constructor(agent: VeramoLikeAgent) {
    this.agent = agent;
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async listKeys(filter?: { did?: string }): Promise<StoredKeyMeta[]> {
    const values = Array.from(this.meta.values());
    if (!filter?.did) return values;
    return values.filter((item) => item.did === filter.did);
  }

  async generateKey(
    params: GenerateKeyInput,
  ): Promise<{ keyRef: string; publicJwk: PublicJwk }> {
    this.ensureReady();
    if (params.crv === "Jubjub") {
      throw new SigningNotSupportedError("Jubjub");
    }
    if (!this.agent.keyManagerCreate) {
      throw new Error("Veramo agent does not provide keyManagerCreate");
    }
    const created = await this.agent.keyManagerCreate({
      type: mapCurve(params.crv),
      kms: "local",
      meta: {
        did: params.did,
        purpose: params.purpose,
      },
    });

    const keyRef = String(created.kid ?? created.id);
    const publicKeyHex = String(created.publicKeyHex ?? "");
    const publicJwk: PublicJwk = {
      kty: params.kty,
      crv: params.crv,
      x: Buffer.from(publicKeyHex, "hex").toString("base64url"),
      y: params.kty === "EC" ? "AA" : undefined,
    };

    const now = new Date().toISOString();
    this.meta.set(keyRef, {
      id: params.id,
      keyRef,
      did: params.did,
      purpose: params.purpose,
      createdAt: now,
      updatedAt: now,
      algorithm: {
        kty: params.kty,
        crv: params.crv,
      },
    });

    return { keyRef, publicJwk };
  }

  async importKey(
    _params: ImportKeyInput,
  ): Promise<{ keyRef: string; publicJwk: PublicJwk }> {
    this.ensureReady();
    if (!this.agent.keyManagerImport) {
      throw new Error("Veramo agent does not provide keyManagerImport");
    }
    throw new Error(
      "Veramo importKey mapping is adapter-specific and must be implemented by caller policy",
    );
  }

  async deriveKeyFromSeed(
    _params: DeriveKeyFromSeedInput,
  ): Promise<{ keyRef: string; publicJwk: PublicJwk }> {
    this.ensureReady();
    throw new Error(
      "Veramo deriveKeyFromSeed is adapter-specific and must be implemented by caller policy",
    );
  }

  async getPublicKey(keyRef: string): Promise<PublicJwk> {
    this.ensureReady();
    const stored = this.meta.get(keyRef);
    if (!stored) throw new Error(`Unknown keyRef ${keyRef}`);
    if (!this.agent.keyManagerGet) {
      throw new Error("Veramo agent does not provide keyManagerGet");
    }
    const key = await this.agent.keyManagerGet({ kid: keyRef });
    const publicKeyHex = String(key.publicKeyHex ?? "");
    return {
      kty: stored.algorithm.kty,
      crv: stored.algorithm.crv,
      x: Buffer.from(publicKeyHex, "hex").toString("base64url"),
      y: stored.algorithm.kty === "EC" ? "AA" : undefined,
    };
  }

  async sign(input: {
    keyRef: string;
    payload: Uint8Array;
  }): Promise<{ signature: Uint8Array; format: "raw" }> {
    this.ensureReady();
    const meta = this.meta.get(input.keyRef);
    if (!meta) throw new Error(`Unknown keyRef ${input.keyRef}`);
    if (meta.algorithm.crv === "Jubjub") {
      throw new SigningNotSupportedError("Jubjub");
    }
    if (!this.agent.keyManagerSign) {
      throw new Error("Veramo agent does not provide keyManagerSign");
    }
    const signed = await this.agent.keyManagerSign({
      keyRef: input.keyRef,
      algorithm: meta.algorithm.crv === "P-256" ? "ES256" : "EdDSA",
      data: Buffer.from(input.payload).toString("base64url"),
      encoding: "base64url",
    });
    const signatureRaw =
      typeof signed.signature === "string" ? signed.signature : "";
    return {
      signature: Buffer.from(signatureRaw, "base64url"),
      format: "raw",
    };
  }

  async verify(_input: VerifyInput): Promise<boolean> {
    this.ensureReady();
    throw new Error(
      "Veramo verify is adapter-specific and should be implemented by consumer policy",
    );
  }

  async deleteKey(keyRef: string): Promise<void> {
    this.meta.delete(keyRef);
  }

  private ensureReady(): void {
    if (!this.initialized) {
      throw new Error("VeramoSecretStore is not initialized");
    }
  }
}
