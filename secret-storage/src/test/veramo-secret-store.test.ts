import { describe, expect, it, vi } from "vitest";

import { SigningNotSupportedError } from "../errors.js";
import { VeramoSecretStore } from "../veramo-secret-store.js";

describe("VeramoSecretStore", () => {
  it("generates keys, stores metadata, fetches public keys and signs payloads", async () => {
    const agent = {
      keyManagerCreate: vi.fn().mockResolvedValue({
        kid: "veramo-key-1",
        publicKeyHex: "01020304",
      }),
      keyManagerGet: vi.fn().mockResolvedValue({
        publicKeyHex: "01020304",
      }),
      keyManagerSign: vi.fn().mockResolvedValue({
        signature: Buffer.from("signature-bytes").toString("base64url"),
      }),
    };
    const store = new VeramoSecretStore(agent);
    await store.initialize({ location: "ignored", passphrase: "ignored" });

    const generated = await store.generateKey({
      id: "auth-main",
      kty: "OKP",
      crv: "Ed25519",
      did: "did:midnight:undeployed:abc",
      purpose: "authentication",
    });

    expect(generated).toMatchObject({
      keyRef: "veramo-key-1",
      publicJwk: {
        kty: "OKP",
        crv: "Ed25519",
        x: Buffer.from("01020304", "hex").toString("base64url"),
      },
    });
    expect(await store.listKeys()).toHaveLength(1);
    expect(
      await store.listKeys({ did: "did:midnight:undeployed:abc" }),
    ).toHaveLength(1);
    expect(await store.getPublicKey("veramo-key-1")).toEqual(
      generated.publicJwk,
    );

    const signed = await store.sign({
      keyRef: "veramo-key-1",
      payload: Buffer.from("payload"),
    });
    expect(Buffer.from(signed.signature).toString()).toBe("signature-bytes");

    await store.deleteKey("veramo-key-1");
    expect(await store.listKeys()).toEqual([]);
  });

  it("rejects unsupported and adapter-specific operations", async () => {
    const store = new VeramoSecretStore({});

    await expect(
      store.generateKey({ id: "before-init", kty: "OKP", crv: "Ed25519" }),
    ).rejects.toThrow("VeramoSecretStore is not initialized");

    await store.initialize({ location: "ignored" });

    await expect(
      store.generateKey({ id: "jubjub", kty: "EC", crv: "Jubjub" }),
    ).rejects.toThrow(SigningNotSupportedError);
    await expect(
      store.generateKey({ id: "missing-create", kty: "OKP", crv: "Ed25519" }),
    ).rejects.toThrow("Veramo agent does not provide keyManagerCreate");
    await expect(
      store.importKey({
        id: "import",
        privateKey: new Uint8Array(32),
        kty: "OKP",
        crv: "Ed25519",
      }),
    ).rejects.toThrow("Veramo agent does not provide keyManagerImport");
    await expect(
      store.deriveKeyFromSeed({
        id: "derive",
        seedHex: "00",
        kty: "OKP",
        crv: "Ed25519",
      }),
    ).rejects.toThrow("Veramo deriveKeyFromSeed is adapter-specific");
    await expect(
      store.verify({ payload: new Uint8Array(), signature: new Uint8Array() }),
    ).rejects.toThrow("Veramo verify is adapter-specific");
    await expect(store.getPublicKey("missing-key")).rejects.toThrow(
      "Unknown keyRef missing-key",
    );
  });

  it("surfaces missing sign/get hooks clearly", async () => {
    const store = new VeramoSecretStore({
      keyManagerCreate: vi
        .fn()
        .mockResolvedValue({ kid: "veramo-key-2", publicKeyHex: "0102" }),
    });
    await store.initialize({ location: "ignored" });
    await store.generateKey({ id: "p256", kty: "EC", crv: "P-256" });

    await expect(store.getPublicKey("veramo-key-2")).rejects.toThrow(
      "Veramo agent does not provide keyManagerGet",
    );
    await expect(
      store.sign({ keyRef: "veramo-key-2", payload: new Uint8Array([1]) }),
    ).rejects.toThrow("Veramo agent does not provide keyManagerSign");
  });
});
