import {
  getNetworkId,
  setNetworkId,
} from "@midnight-ntwrk/midnight-js-network-id";
import { afterAll, describe, expect, it, vi } from "vitest";

import { getDidSubject } from "../did-subject.js";
import { type DeployedMidnightDIDContract } from "../types.js";
import { verifySchnorrJubjubDigestSignature } from "../verification-method-operations.js";

let previousNetworkId: string | undefined;
try {
  previousNetworkId = getNetworkId();
} catch {
  previousNetworkId = undefined;
}
setNetworkId("undeployed");
afterAll(() => {
  if (previousNetworkId !== undefined) {
    setNetworkId(previousNetworkId);
  }
});

const didContract = {
  deployTxData: {
    public: {
      contractAddress:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    },
  },
  callTx: {
    verifySchnorrJubjubDigestSignature: vi.fn(async () => ({
      public: { txId: "0x1" },
    })),
  },
} as unknown as DeployedMidnightDIDContract;

describe("verification method operations", () => {
  it("verifies SchnorrJubjub signatures against a normalized ledger method id", async () => {
    const didSubject = getDidSubject(didContract);
    const digest = [1n, 2n, 3n, 4n] as [bigint, bigint, bigint, bigint];
    const signature = {
      announcement: { x: 5n, y: 6n },
      response: 7n,
    };

    await expect(
      verifySchnorrJubjubDigestSignature(
        didContract,
        `${didSubject}#key-1`,
        digest,
        signature,
      ),
    ).resolves.toEqual({ txId: "0x1" });

    expect(
      didContract.callTx.verifySchnorrJubjubDigestSignature,
    ).toHaveBeenCalledWith(`${didSubject}#key-1`, digest, signature);
  });
});
