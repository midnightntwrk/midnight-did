import { describe, it, expect } from "vitest";

import { MessageBus } from "../../transport/message-bus.js";
import type { ProtocolMessage } from "../../transport/types.js";

const dummyMessage = (from: string, to: string, type = "issuance:offer" as const): ProtocolMessage => ({
  type,
  from,
  to,
  envelope: {} as ProtocolMessage["envelope"],
  body: { test: true },
});

describe("MessageBus", () => {
  it("delivers a message from sender to receiver", () => {
    const bus = new MessageBus();
    bus.send(dummyMessage("issuer", "holder"));
    const received = bus.receive("holder");
    expect(received).toBeDefined();
    expect(received!.from).toBe("issuer");
    expect(received!.body).toEqual({ test: true });
  });

  it("returns undefined when no messages are pending", () => {
    const bus = new MessageBus();
    expect(bus.receive("holder")).toBeUndefined();
  });

  it("does not deliver messages to the wrong party", () => {
    const bus = new MessageBus();
    bus.send(dummyMessage("issuer", "holder"));
    expect(bus.receive("verifier")).toBeUndefined();
    expect(bus.receive("holder")).toBeDefined();
  });

  it("delivers messages in FIFO order", () => {
    const bus = new MessageBus();
    bus.send(dummyMessage("issuer", "holder", "issuance:offer"));
    bus.send(dummyMessage("verifier", "holder", "presentation:request"));
    const first = bus.receive("holder");
    const second = bus.receive("holder");
    expect(first!.type).toBe("issuance:offer");
    expect(second!.type).toBe("presentation:request");
  });

  it("drains all messages for a party", () => {
    const bus = new MessageBus();
    bus.send(dummyMessage("a", "holder"));
    bus.send(dummyMessage("b", "holder"));
    const all = bus.drain("holder");
    expect(all).toHaveLength(2);
    expect(bus.receive("holder")).toBeUndefined();
  });
});
