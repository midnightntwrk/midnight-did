import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  SecretNotFoundError,
  SecretStoreInitError,
  SecretStoreLockedError,
} from "../errors.js";
import { FileSecretStore } from "../file-secret-store.js";

const tempDirs: string[] = [];
const payload = Buffer.from("file-secret-store-payload", "utf8");
const seedHex =
  "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";

const createTempPath = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "midnight-secret-store-"));
  tempDirs.push(dir);
  return path.join(dir, "secrets.json");
};

afterEach(async () => {
  await Promise.all(
    tempDirs
      .splice(0)
      .map(async (dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("FileSecretStore", () => {
  it("requires a passphrase to initialize", async () => {
    const store = new FileSecretStore();
    const location = await createTempPath();

    await expect(store.initialize({ location })).rejects.toThrow(
      SecretStoreLockedError,
    );
  });

  it("creates, persists, lists, signs, verifies and deletes keys", async () => {
    const location = await createTempPath();
    const store = new FileSecretStore();
    await store.initialize({ location, passphrase: "midnight-passphrase" });

    expect(await store.listKeys()).toEqual([]);

    const generated = await store.generateKey({
      id: "auth-main",
      kty: "OKP",
      crv: "Ed25519",
      did: "did:midnight:undeployed:abc",
      purpose: "authentication",
    });

    const listed = await store.listKeys({ did: "did:midnight:undeployed:abc" });
    expect(listed).toHaveLength(1);
    expect(await store.getPublicKey(generated.keyRef)).toEqual(
      generated.publicJwk,
    );

    const signed = await store.sign({ keyRef: generated.keyRef, payload });
    await expect(
      store.verify({
        keyRef: generated.keyRef,
        payload,
        signature: signed.signature,
      }),
    ).resolves.toBe(true);
    await expect(
      store.verify({
        publicJwk: generated.publicJwk,
        payload,
        signature: signed.signature,
      }),
    ).resolves.toBe(true);

    const ledgerPublic = await store.getPublicForLedger(generated.keyRef);
    expect(ledgerPublic).toMatchObject({
      kty: "OKP",
      crv: "Ed25519",
      x: expect.any(BigInt),
      y: expect.any(BigInt),
    });

    await store.deleteKey(generated.keyRef);
    await expect(store.getPublicKey(generated.keyRef)).rejects.toThrow(
      SecretNotFoundError,
    );
  });

  it("imports and derives keys, then persists encrypted state on disk", async () => {
    const location = await createTempPath();
    const store = new FileSecretStore();
    await store.initialize({ location, passphrase: "midnight-passphrase" });

    const derived = await store.deriveKeyFromSeed({
      id: "seeded-p256",
      seedHex,
      kty: "EC",
      crv: "P-256",
      did: "did:midnight:undeployed:def",
    });
    const imported = await store.importKey({
      id: "jubjub-import",
      privateKey: new Uint8Array(32).fill(7),
      kty: "EC",
      crv: "Jubjub",
    });

    const rawFile = JSON.parse(await readFile(location, "utf8")) as {
      encrypted?: unknown;
      keys?: unknown;
    };
    expect(rawFile.encrypted).toBeDefined();
    expect(rawFile.keys).toBeUndefined();

    const reopened = new FileSecretStore();
    await reopened.initialize({ location, passphrase: "midnight-passphrase" });
    expect(await reopened.getPublicKey(derived.keyRef)).toEqual(
      derived.publicJwk,
    );
    expect(await reopened.getPublicKey(imported.keyRef)).toEqual(
      imported.publicJwk,
    );
  });

  it("rejects invalid reopen/verify flows", async () => {
    const location = await createTempPath();
    const store = new FileSecretStore();
    await store.initialize({ location, passphrase: "midnight-passphrase" });

    await expect(
      store.verify({ payload, signature: new Uint8Array(64) }),
    ).rejects.toThrow(SecretStoreInitError);

    const reopened = new FileSecretStore();
    await expect(
      reopened.initialize({ location, passphrase: "wrong-passphrase" }),
    ).rejects.toThrow(SecretStoreInitError);
  });
});
