import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { classifyManagerHttpError } from "../errors.js";

describe("classifyManagerHttpError", () => {
  it("flattens zod seed validation errors into a readable message", () => {
    const error = new ZodError([
      {
        code: "custom",
        path: [],
        message: "Seed must contain only hexadecimal characters",
      },
      {
        code: "custom",
        path: [],
        message: "Seed must be exactly 64 hex characters (32 bytes)",
      },
    ]);

    expect(classifyManagerHttpError(error)).toEqual({
      statusCode: 400,
      errorCode: "invalidSeed",
      message:
        "Seed must contain only hexadecimal characters; Seed must be exactly 64 hex characters (32 bytes)",
    });
  });

  it.each([
    "Active DID is deactivated and cannot sign payloads.",
    "Selected key is associated with did:midnight:preprod:abc, not the active DID did:midnight:preprod:def.",
    "Selected key is not published in the active DID document as a verification method.",
    "Bytes payload must be an even-length hexadecimal string",
    "JSON payload is invalid: Unexpected token",
    "Verification method id must be an absolute Midnight DID URL with a fragment.",
    "Verification method did:midnight:preprod:abc#key-1 was not found in did:midnight:preprod:abc.",
    "Local key verification requires an active secret store session.",
    "DID verification requires a verification method resolver.",
    "Verification requires exactly one source: keyRef, publicJwk, or verificationMethodId.",
    "Unsupported signature curve secp256k1",
    "Signature must be a valid base64url-encoded byte string.",
  ])("maps signature validation errors to invalidRequest: %s", (message) => {
    expect(classifyManagerHttpError(new Error(message))).toEqual({
      statusCode: 400,
      errorCode: "invalidRequest",
      message,
    });
  });

  it("maps missing local signing keys to secretNotFound", () => {
    const message = "Key not found in secret storage: key-ref-1";

    expect(classifyManagerHttpError(new Error(message))).toEqual({
      statusCode: 404,
      errorCode: "secretNotFound",
      message,
    });
  });

  it("maps unresolved active DID contracts to contractNotFound", () => {
    const message = "Active DID contract could not be resolved on the current network.";

    expect(classifyManagerHttpError(new Error(message))).toEqual({
      statusCode: 404,
      errorCode: "contractNotFound",
      message,
    });
  });
});
