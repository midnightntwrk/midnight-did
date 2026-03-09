import { describe, expect, it } from "vitest";

import {
  classifyResolutionError,
  statusCodeForResolutionError,
} from "../resolution-errors";

describe("did-resolver-service resolution errors", () => {
  it("classifies invalid did and endpoint validation errors", () => {
    expect(
      classifyResolutionError(new Error("Invalid Midnight DID format")),
    ).toBe("invalidDid");
    expect(
      classifyResolutionError(new Error("indexerWsUrl must use ws or wss")),
    ).toBe("invalidDid");
  });

  it("classifies network mismatch and internal errors", () => {
    expect(classifyResolutionError(new Error("Network mismatch"))).toBe(
      "networkMismatch",
    );
    expect(classifyResolutionError(new Error("boom"))).toBe("internalError");
    expect(classifyResolutionError("non-error")).toBe("internalError");
  });

  it("maps error codes to status codes", () => {
    expect(statusCodeForResolutionError("invalidDid")).toBe(400);
    expect(statusCodeForResolutionError("networkMismatch")).toBe(400);
    expect(statusCodeForResolutionError("notFound")).toBe(404);
    expect(statusCodeForResolutionError("internalError")).toBe(500);
  });
});
