import { sha256 } from "./secure-store.js";

export type PasskeyUnlockMaterial = {
  readonly credentialId: string;
  readonly prfOutput: Uint8Array;
};

// Prototype stand-in for WebAuthn PRF. A production wallet should obtain this
// from a platform authenticator and never expose the PRF output to app code.
export const createPrototypePasskeyUnlockMaterial = (
  profileId: string,
): PasskeyUnlockMaterial => ({
  credentialId: `passkey:${profileId}:device-1`,
  prfOutput: sha256(`passkey-prf:${profileId}:device-1`),
});
