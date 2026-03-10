import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { decryptJson, type EncryptedPayload, encryptJson } from "./crypto";
import {
  generateCurveKey,
  importCurveKey,
  normalizePublicForLedger,
  signWithCurveKey,
  type StoredPrivateRecord,
  verifyWithPublicJwk,
} from "./curve-support";
import {
  SecretNotFoundError,
  SecretStoreInitError,
  SecretStoreLockedError,
} from "./errors";
import { deriveCurvePrivateFromSeed } from "./hd-derivation";
import type {
  DeriveKeyFromSeedInput,
  GenerateKeyInput,
  ImportKeyInput,
  PublicJwk,
  SecretStorage,
  StoredKeyMeta,
  VerifyInput,
} from "./types";

type StoredEntry = {
  meta: StoredKeyMeta;
  privateRecord: StoredPrivateRecord;
  publicJwk: PublicJwk;
};

type StoreFile = {
  version: 1;
  keys: Record<string, StoredEntry>;
};

type FileEnvelope = {
  version: 1;
  encrypted: EncryptedPayload;
};

const nowIso = (): string => new Date().toISOString();

export class FileSecretStore implements SecretStorage {
  private location = "";
  private passphrase = "";
  private store: StoreFile = { version: 1, keys: {} };

  async initialize(params: {
    location: string;
    passphrase?: string;
  }): Promise<void> {
    this.location = params.location;
    if (!params.passphrase) {
      throw new SecretStoreLockedError();
    }
    this.passphrase = params.passphrase;

    const dir = path.dirname(this.location);
    await mkdir(dir, { recursive: true });

    try {
      const raw = await readFile(this.location, "utf8");
      const envelope = JSON.parse(raw) as FileEnvelope;
      const decrypted = await decryptJson(envelope.encrypted, this.passphrase);
      this.store = JSON.parse(decrypted) as StoreFile;
    } catch (error) {
      const maybeErr = error as { code?: string };
      if (maybeErr.code === "ENOENT") {
        this.store = { version: 1, keys: {} };
        await this.persist();
        return;
      }
      throw new SecretStoreInitError(
        `Failed to initialize file secret store: ${String(error)}`,
      );
    }
  }

  async listKeys(filter?: { did?: string }): Promise<StoredKeyMeta[]> {
    const keys = Object.values(this.store.keys).map((entry) => entry.meta);
    if (!filter?.did) return keys;
    return keys.filter((entry) => entry.did === filter.did);
  }

  async generateKey(
    params: GenerateKeyInput,
  ): Promise<{ keyRef: string; publicJwk: PublicJwk }> {
    const generated = await generateCurveKey(params.kty, params.crv);
    const keyRef = randomUUID();
    const timestamp = nowIso();
    this.store.keys[keyRef] = {
      meta: {
        id: params.id,
        keyRef,
        did: params.did,
        purpose: params.purpose,
        createdAt: timestamp,
        updatedAt: timestamp,
        algorithm: {
          kty: params.kty,
          crv: params.crv,
        },
      },
      privateRecord: generated.record,
      publicJwk: generated.publicJwk,
    };
    await this.persist();
    return { keyRef, publicJwk: generated.publicJwk };
  }

  async importKey(
    params: ImportKeyInput,
  ): Promise<{ keyRef: string; publicJwk: PublicJwk }> {
    const imported = await importCurveKey(params);
    const keyRef = randomUUID();
    const timestamp = nowIso();
    this.store.keys[keyRef] = {
      meta: {
        id: params.id,
        keyRef,
        did: params.did,
        purpose: params.purpose,
        createdAt: timestamp,
        updatedAt: timestamp,
        algorithm: {
          kty: params.kty,
          crv: params.crv,
        },
      },
      privateRecord: imported.record,
      publicJwk: imported.publicJwk,
    };
    await this.persist();
    return { keyRef, publicJwk: imported.publicJwk };
  }

  async deriveKeyFromSeed(
    params: DeriveKeyFromSeedInput,
  ): Promise<{ keyRef: string; publicJwk: PublicJwk }> {
    const derived = deriveCurvePrivateFromSeed(params);
    return this.importKey({
      id: params.id,
      privateKey: derived.privateKey,
      kty: derived.kty,
      crv: derived.crv,
      did: params.did,
      purpose: params.purpose,
    });
  }

  async getPublicKey(keyRef: string): Promise<PublicJwk> {
    const entry = this.store.keys[keyRef];
    if (!entry) throw new SecretNotFoundError(keyRef);
    return entry.publicJwk;
  }

  async sign(input: {
    keyRef: string;
    payload: Uint8Array;
  }): Promise<{ signature: Uint8Array; format: "raw" }> {
    const entry = this.store.keys[input.keyRef];
    if (!entry) throw new SecretNotFoundError(input.keyRef);
    return {
      signature: await signWithCurveKey(entry.privateRecord, input.payload),
      format: "raw",
    };
  }

  async verify(input: VerifyInput): Promise<boolean> {
    const publicJwk =
      input.publicJwk ??
      (input.keyRef ? await this.getPublicKey(input.keyRef) : undefined);
    if (!publicJwk) {
      throw new SecretStoreInitError("verify requires keyRef or publicJwk");
    }
    return verifyWithPublicJwk(publicJwk, input.payload, input.signature);
  }

  async deleteKey(keyRef: string): Promise<void> {
    if (!this.store.keys[keyRef]) throw new SecretNotFoundError(keyRef);
    delete this.store.keys[keyRef];
    await this.persist();
  }

  async getPublicForLedger(keyRef: string): Promise<{
    kty: "EC" | "OKP";
    crv: "Ed25519" | "Jubjub" | "P-256";
    x: bigint;
    y: bigint;
  }> {
    const publicJwk = await this.getPublicKey(keyRef);
    return normalizePublicForLedger(publicJwk);
  }

  private async persist(): Promise<void> {
    if (!this.passphrase) throw new SecretStoreLockedError();
    const encrypted = await encryptJson(
      JSON.stringify(this.store),
      this.passphrase,
    );
    const envelope: FileEnvelope = {
      version: 1,
      encrypted,
    };
    await writeFile(this.location, JSON.stringify(envelope, null, 2), "utf8");
  }
}
