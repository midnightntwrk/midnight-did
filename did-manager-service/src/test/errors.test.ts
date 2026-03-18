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
});
