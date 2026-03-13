import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { decryptJson, deriveKey, encryptJson } from "../crypto.js";

describe("crypto helpers", () => {
  it("derives a deterministic 32-byte key from passphrase and salt", async () => {
    const salt = Buffer.from("00112233445566778899aabbccddeeff", "hex");

    const first = await deriveKey("midnight-passphrase", salt);
    const second = await deriveKey("midnight-passphrase", salt);

    expect(first).toHaveLength(32);
    expect(Buffer.compare(first, second)).toBe(0);
  });

  it("encrypts and decrypts JSON payloads", async () => {
    const plaintext = JSON.stringify({
      did: "did:midnight:undeployed:abc",
      version: 1,
    });

    const encrypted = await encryptJson(plaintext, "midnight-passphrase");
    const decrypted = await decryptJson(encrypted, "midnight-passphrase");

    expect(encrypted).toMatchObject({
      salt: expect.any(String),
      iv: expect.any(String),
      tag: expect.any(String),
      ciphertext: expect.any(String),
    });
    expect(decrypted).toBe(plaintext);
  });

  it("fails to decrypt with the wrong passphrase", async () => {
    const encrypted = await encryptJson(
      randomBytes(24).toString("hex"),
      "correct-passphrase",
    );

    await expect(decryptJson(encrypted, "wrong-passphrase")).rejects.toThrow();
  });
});
