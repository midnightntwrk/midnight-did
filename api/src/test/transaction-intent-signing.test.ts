import { describe, expect, it, vi } from "vitest";

import {
  type SignableTransactionIntent,
  signTransactionIntents,
} from "../transaction-intent-signing";

const makeOffer = (existingSignature?: unknown) => {
  const addedSignatures: unknown[][] = [];
  return {
    offer: {
      inputs: [{ id: "input-1" }, { id: "input-2" }],
      signatures: {
        at: (index: number) => (index === 1 ? existingSignature : undefined),
      },
      addSignatures: (signatures: unknown[]) => {
        addedSignatures.push(signatures);
        return {
          inputs: [{ id: "input-1" }, { id: "input-2" }],
          signatures: { at: (index: number) => signatures.at(index) },
          addSignatures: vi.fn(),
        };
      },
    } as SignableTransactionIntent["fallibleUnshieldedOffer"],
    addedSignatures,
  };
};

describe("transaction intent signing workaround", () => {
  it("signs each intent segment with segment-specific payload and preserves existing signatures", () => {
    const segmentOneOffer = makeOffer("existing-1");
    const segmentTwoOffer = makeOffer("existing-2");
    const signedIntents = new Map<number, SignableTransactionIntent>([
      [
        1,
        {
          serialize: () => new Uint8Array([1]),
          signatureData: (segment) => new Uint8Array([segment, 10]),
          fallibleUnshieldedOffer: segmentOneOffer.offer,
        },
      ],
      [
        2,
        {
          serialize: () => new Uint8Array([2]),
          signatureData: (segment) => new Uint8Array([segment, 20]),
          guaranteedUnshieldedOffer: segmentTwoOffer.offer,
        },
      ],
    ]);
    const tx = {
      intents: new Map([
        [1, { serialize: () => new Uint8Array([1]) }],
        [2, { serialize: () => new Uint8Array([2]) }],
      ]),
    };
    const deserializeIntent = vi.fn(
      (serializedIntent: Uint8Array): SignableTransactionIntent =>
        signedIntents.get(serializedIntent[0])!,
    );
    const signFn = vi.fn(
      (payload: Uint8Array) =>
        `signature-for-${Array.from(payload).join("-")}` as never,
    );

    signTransactionIntents(tx, signFn, "proof", deserializeIntent);

    expect(deserializeIntent).toHaveBeenCalledTimes(2);
    expect(deserializeIntent).toHaveBeenNthCalledWith(
      1,
      new Uint8Array([1]),
      "proof",
    );
    expect(deserializeIntent).toHaveBeenNthCalledWith(
      2,
      new Uint8Array([2]),
      "proof",
    );
    expect(signFn).toHaveBeenNthCalledWith(1, new Uint8Array([1, 10]));
    expect(signFn).toHaveBeenNthCalledWith(2, new Uint8Array([2, 20]));
    expect(segmentOneOffer.addedSignatures).toEqual([
      ["signature-for-1-10", "existing-1"],
    ]);
    expect(segmentTwoOffer.addedSignatures).toEqual([
      ["signature-for-2-20", "existing-2"],
    ]);
    expect(tx.intents.get(1)).toBe(signedIntents.get(1));
    expect(tx.intents.get(2)).toBe(signedIntents.get(2));
  });
});
