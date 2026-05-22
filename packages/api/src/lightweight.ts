import { webcrypto } from "node:crypto";

export async function hashProverKey(
  proverKey: Uint8Array,
): Promise<Uint8Array> {
  const hash = await webcrypto.subtle.digest("SHA-256", proverKey);
  return new Uint8Array(hash);
}

export const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  webcrypto.getRandomValues(bytes);
  return bytes;
};
