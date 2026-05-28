export const randomBytes = (length: number): Uint8Array => {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("randomBytes requires Web Crypto getRandomValues");
  }

  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
};
