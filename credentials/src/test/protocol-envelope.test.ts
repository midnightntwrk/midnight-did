import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { pureCircuits } from "../managed/credentials/contract/index.js";
import { createProtocolEnvelope } from "./protocol-fixtures.js";

setNetworkId("undeployed");

describe("credentials core: protocol envelopes", () => {
  it("accepts a valid initial protocol message envelope", () => {
    const envelope = createProtocolEnvelope({
      label: "offer",
      threadLabel: "issuance",
      initialMessage: true,
      createdAt: 100n,
      expiresAt: 200n,
    });

    expect(() =>
      pureCircuits.assertValidProtocolMessageEnvelope(envelope),
    ).not.toThrow();
  });

  it("rejects an initial envelope that claims to respond to a previous message", () => {
    const envelope = createProtocolEnvelope({
      label: "offer",
      threadLabel: "issuance",
      initialMessage: true,
      respondsToMessageId: new Uint8Array(32).fill(7),
      createdAt: 100n,
    });

    expect(() =>
      pureCircuits.assertValidProtocolMessageEnvelope(envelope),
    ).toThrow(/Initial protocol message must not reference a previous message/);
  });

  it("accepts a response envelope aligned to the request thread and message id", () => {
    const requestEnvelope = createProtocolEnvelope({
      label: "request",
      threadLabel: "presentation",
      initialMessage: true,
      createdAt: 200n,
    });
    const responseEnvelope = createProtocolEnvelope({
      label: "submission",
      threadLabel: "presentation",
      initialMessage: false,
      respondsToMessageId: requestEnvelope.messageId,
      createdAt: 201n,
    });

    expect(() =>
      pureCircuits.assertProtocolResponseEnvelope(
        requestEnvelope,
        responseEnvelope,
      ),
    ).not.toThrow();
  });

  it("rejects a response envelope on the wrong thread", () => {
    const requestEnvelope = createProtocolEnvelope({
      label: "request",
      threadLabel: "presentation",
      initialMessage: true,
      createdAt: 200n,
    });
    const responseEnvelope = createProtocolEnvelope({
      label: "submission",
      threadLabel: "another-thread",
      initialMessage: false,
      respondsToMessageId: requestEnvelope.messageId,
      createdAt: 201n,
    });

    expect(() =>
      pureCircuits.assertProtocolResponseEnvelope(
        requestEnvelope,
        responseEnvelope,
      ),
    ).toThrow(
      /Protocol response thread id does not match the request thread id/,
    );
  });
});
