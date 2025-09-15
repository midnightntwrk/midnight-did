import { describe, expect, it } from "vitest";

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
