import { describe, expect, it } from "vitest";

import {
  SecretNotFoundError,
  SecretStoreError,
  SecretStoreInitError,
  SecretStoreLockedError,
  SigningNotSupportedError,
  UnsupportedCurveError,
  VerificationFailedError,
} from "../errors.js";
import * as secretStorage from "../index.js";

describe("error types", () => {
  it("exposes named secret-store errors", () => {
    expect(new SecretStoreError("boom")).toMatchObject({
      name: "SecretStoreError",
      message: "boom",
    });
    expect(new SecretStoreInitError("init failed")).toMatchObject({
      name: "SecretStoreInitError",
      message: "init failed",
    });
    expect(new SecretStoreLockedError()).toMatchObject({
      name: "SecretStoreLockedError",
      message: "Secret store requires a passphrase",
    });
    expect(new SecretNotFoundError("key-1")).toMatchObject({
      name: "SecretNotFoundError",
      message: "Secret not found: key-1",
    });
    expect(new UnsupportedCurveError("EC/X25519")).toMatchObject({
      name: "UnsupportedCurveError",
      message: "Unsupported curve: EC/X25519",
    });
    expect(new SigningNotSupportedError("Jubjub")).toMatchObject({
      name: "SigningNotSupportedError",
      message:
        "Signing is not supported for curve Jubjub in this implementation",
    });
    expect(new VerificationFailedError()).toMatchObject({
      name: "VerificationFailedError",
      message: "Signature verification failed",
    });
  });
});

describe("package index", () => {
  it("re-exports the public secret-storage surface", () => {
    expect(secretStorage.FileSecretStore).toBeDefined();
    expect(secretStorage.VeramoSecretStore).toBeDefined();
    expect(secretStorage.generateCurveKey).toBeDefined();
    expect(secretStorage.deriveCurvePrivateFromSeed).toBeDefined();
    expect(secretStorage.payloadToJubjubDigest).toBeDefined();
    expect(secretStorage.verifyJubjubPayload).toBeDefined();
    expect(secretStorage.decodeJubjubSignature).toBeDefined();
    expect(secretStorage.JUBJUB_SIGNATURE_LENGTH_BYTES).toBe(96);
    expect(secretStorage.SeedSchema).toBeDefined();
    expect(secretStorage.parseSeed).toBeDefined();
    expect(secretStorage.SecretStoreLockedError).toBeDefined();
  });
});
