import {
  getNetworkId,
  setNetworkId,
} from "@midnight-ntwrk/midnight-js-network-id";
import { afterAll, describe, expect, it } from "vitest";

import {
  createUnshieldedKeystoreFromKeys,
  deriveMidnightWalletKeys,
  deriveUnshieldedAddressFromSeed,
} from "../wallet-keys.js";

const seed = "11".repeat(32);
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

describe("wallet key derivation", () => {
  it("derives stable role keys from a valid seed", () => {
    const first = deriveMidnightWalletKeys(seed);
    const second = deriveMidnightWalletKeys(seed);

    expect(first).toEqual(second);
    expect(createUnshieldedKeystoreFromKeys(first).getBech32Address()).toEqual(
      createUnshieldedKeystoreFromKeys(second).getBech32Address(),
    );
  });

  it("derives a stable unshielded address from a seed", () => {
    expect(deriveUnshieldedAddressFromSeed(seed)).toBe(
      deriveUnshieldedAddressFromSeed(seed),
    );
  });

  it.each(["", "not-hex", "00", `${"00".repeat(31)}1`])(
    "rejects malformed seed %j",
    (invalidSeed) => {
      expect(() => deriveMidnightWalletKeys(invalidSeed)).toThrow();
    },
  );
});
