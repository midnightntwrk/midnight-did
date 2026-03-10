import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt as scryptCb,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);
const KEY_SIZE = 32;
const IV_SIZE = 12;

export type EncryptedPayload = {
  salt: string;
  iv: string;
  tag: string;
  ciphertext: string;
};

export const deriveKey = async (
  passphrase: string,
  salt: Buffer,
): Promise<Buffer> => {
  const key = await scrypt(passphrase, salt, KEY_SIZE);
  return Buffer.from(key as ArrayBuffer);
};

export const encryptJson = async (
  plaintext: string,
  passphrase: string,
): Promise<EncryptedPayload> => {
  const salt = randomBytes(16);
  const iv = randomBytes(IV_SIZE);
  const key = await deriveKey(passphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
};

export const decryptJson = async (
  payload: EncryptedPayload,
  passphrase: string,
): Promise<string> => {
  const salt = Buffer.from(payload.salt, "base64");
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const ciphertext = Buffer.from(payload.ciphertext, "base64");
  const key = await deriveKey(passphrase, salt);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
};
