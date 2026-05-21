import { beforeEach, describe, expect, it, vi } from "vitest";

const ledgerMocks = vi.hoisted(() => ({
  deserialize: vi.fn(),
}));

vi.mock("@midnight-ntwrk/ledger-v8", () => ({
  Intent: {
    deserialize: ledgerMocks.deserialize,
  },
}));

import { signTransactionIntents } from "../transaction-intents.js";

const offerWithSignatures = (signatures: unknown[] = []) => ({
  inputs: [{}, {}],
  signatures,
  addSignatures: vi.fn((nextSignatures: unknown[]) => ({
    inputs: [{}, {}],
    signatures: nextSignatures,
  })),
});

describe("transaction intent signing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when a transaction has no intents", () => {
    const signFn = vi.fn();

    signTransactionIntents({}, signFn, "proof");
    signTransactionIntents({ intents: new Map() }, signFn, "proof");

    expect(ledgerMocks.deserialize).not.toHaveBeenCalled();
    expect(signFn).not.toHaveBeenCalled();
  });

  it("rewrites each intent with signed unshielded offers", () => {
    const serialized = new Uint8Array([1, 2, 3]);
    const signatureData = new Uint8Array([7, 8, 9]);
    const existingSignature = { existing: true };
    const signature = { signed: true };
    const fallibleUnshieldedOffer = offerWithSignatures([existingSignature]);
    const guaranteedUnshieldedOffer = offerWithSignatures();
    const clonedIntent = {
      signatureData: vi.fn(() => signatureData),
      fallibleUnshieldedOffer,
      guaranteedUnshieldedOffer,
    };
    ledgerMocks.deserialize.mockReturnValue(clonedIntent);

    const tx = {
      intents: new Map([
        [
          7,
          {
            serialize: () => serialized,
          },
        ],
      ]),
    };
    const signFn = vi.fn(() => signature as any);

    signTransactionIntents(tx, signFn, "pre-proof");

    expect(ledgerMocks.deserialize).toHaveBeenCalledWith(
      "signature",
      "pre-proof",
      "pre-binding",
      serialized,
    );
    expect(clonedIntent.signatureData).toHaveBeenCalledWith(7);
    expect(signFn).toHaveBeenCalledWith(signatureData);
    expect(fallibleUnshieldedOffer.addSignatures).toHaveBeenCalledWith([
      existingSignature,
      signature,
    ]);
    expect(guaranteedUnshieldedOffer.addSignatures).toHaveBeenCalledWith([
      signature,
      signature,
    ]);
    expect(tx.intents.get(7)).toBe(clonedIntent);
  });
});
