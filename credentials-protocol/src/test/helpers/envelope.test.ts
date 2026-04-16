import { describe, expect, it } from "vitest";

import { createEnvelope, resetEnvelopeCounter } from "../../shared/envelope.js";

describe("protocol envelope helper", () => {
  it("reuses the request thread id for response messages", () => {
    resetEnvelopeCounter();

    const request = createEnvelope(
      "issuance-offer",
      "birth-issuance",
      true,
    );
    const response = createEnvelope(
      "issuance-request",
      "birth-issuance",
      false,
      request.messageId,
      request.threadId,
    );

    expect(response.initialMessage).toBe(false);
    expect(response.respondsToMessageId).toEqual(request.messageId);
    expect(response.threadId).toEqual(request.threadId);
  });
});
