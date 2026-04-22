import { Buffer } from "node:buffer";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
} from "node:crypto";

export type EncryptedEnvelope = {
  readonly iv: Uint8Array;
  readonly authTag: Uint8Array;
  readonly ciphertext: Uint8Array;
};

export const sha256 = (value: string): Uint8Array =>
  new Uint8Array(createHash("sha256").update(value).digest());

export const deriveStoreKey = (
  prfOutput: Uint8Array,
  info: string,
): Uint8Array =>
  new Uint8Array(
    hkdfSync("sha256", prfOutput, Buffer.alloc(0), Buffer.from(info), 32),
  );

export const encryptAesGcm = ({
  key,
  plaintext,
  iv,
}: {
  readonly key: Uint8Array;
  readonly plaintext: Uint8Array;
  readonly iv: Uint8Array;
}): EncryptedEnvelope => {
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    iv,
    authTag: cipher.getAuthTag(),
    ciphertext,
  };
};

export const decryptAesGcm = ({
  key,
  envelope,
}: {
  readonly key: Uint8Array;
  readonly envelope: EncryptedEnvelope;
}): Uint8Array => {
  const decipher = createDecipheriv("aes-256-gcm", key, envelope.iv);
  decipher.setAuthTag(envelope.authTag);
  return Buffer.concat([
    decipher.update(envelope.ciphertext),
    decipher.final(),
  ]);
};
