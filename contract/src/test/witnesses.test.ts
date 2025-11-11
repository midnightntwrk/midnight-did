import { describe, expect, it, vi } from "vitest";

import { type MidnightDIDPrivateState, witnesses } from "../witnesses";

describe("witnesses.localSecretKey", () => {
  it("returns [privateState, secretKey] tuple", () => {
    const sk = new Uint8Array(32).fill(7);
    const privateState: MidnightDIDPrivateState = { secretKey: sk };
    // Minimal shape to satisfy the destructuring used by the witness
    const ctx = { privateState } as any;

    const [returnedState, returnedKey] = witnesses.localSecretKey(ctx);
    expect(returnedState).toBe(privateState);
    expect(returnedKey).toBe(sk);
    expect(returnedKey.length).toBe(32);
  });
});

describe("witnesses.currentTimestamp", () => {
  it("returns the current epoch milliseconds as bigint", () => {
    vi.useFakeTimers();
    const fixed = new Date("2024-01-01T00:00:00Z");
    vi.setSystemTime(fixed);
    const sk = new Uint8Array(32).fill(1);
    const privateState: MidnightDIDPrivateState = { secretKey: sk };
    const ctx = { privateState } as any;

    const [, timestamp] = witnesses.currentTimestamp(ctx);
    expect(timestamp).toBe(BigInt(fixed.getTime()));
    vi.useRealTimers();
  });
});
