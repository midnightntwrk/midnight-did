export * from "./curve-support.js";
export * from "./errors.js";
export * from "./file-secret-store.js";
export * from "./hd-derivation.js";
export * from "./seed.js";
export * from "./types.js";
export * from "./veramo-secret-store.js";
export {
  computeJubjubDigestChallenge,
  decodeJubjubSignature,
  deriveJubjubPublicKey,
  deriveJubjubPublicKeyFromSeed,
  encodeJubjubSignature,
  type JubjubDigest,
  type JubjubSchnorrSignature,
  payloadToJubjubDigest,
  signJubjubDigest,
  signJubjubDigestFromSeed,
  signJubjubPayloadFromSeed,
  verifyJubjubDigest,
  verifyJubjubPayload,
} from "@midnight-ntwrk/midnight-did-jubjub-schnorr";
