import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  asSchnorrJubjubDigest,
  createControllerAuthorization,
} from "../controller-authorization.js";
import { requireDeployedMidnightDIDLedgerState } from "../ledger-state.js";
import { requirePrivateState } from "../private-state.js";

vi.mock("@midnight-ntwrk/midnight-did-contract", () => ({
  signControllerAuthorization: vi.fn(),
}));

vi.mock("../ledger-state.js", () => ({
  requireDeployedMidnightDIDLedgerState: vi.fn(),
}));

vi.mock("../private-state.js", () => ({
  requirePrivateState: vi.fn(),
}));

describe("controller authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a four-field digest", () => {
    expect(asSchnorrJubjubDigest([1n, 2n, 3n, 4n])).toEqual([1n, 2n, 3n, 4n]);
    expect(() => asSchnorrJubjubDigest([1n, 2n, 3n])).toThrow(
      "Controller authorization digest must have exactly 4 fields",
    );
    expect(() => asSchnorrJubjubDigest([1n, 2n, 3n, 4n, 5n])).toThrow(
      "Controller authorization digest must have exactly 4 fields",
    );
  });

  it("signs the wallet-private controller secret against the current ledger state", async () => {
    const { signControllerAuthorization } =
      await import("@midnight-ntwrk/midnight-did-contract");
    const privateState = { secretKey: new Uint8Array([7, 8, 9]) };
    const ledgerState = { id: "did-id", version: 12n };
    const digest = [1n, 2n, 3n, 4n] as const;
    const signature = { r: 5n, s: 6n };
    vi.mocked(requirePrivateState).mockResolvedValue(privateState as any);
    vi.mocked(requireDeployedMidnightDIDLedgerState).mockResolvedValue(
      ledgerState as any,
    );
    vi.mocked(signControllerAuthorization).mockReturnValue(signature as any);

    const didContract = { id: "contract" } as any;
    const providers = { privateStateProvider: {} } as any;
    const digestFactory = vi.fn(() => digest as any);

    await expect(
      createControllerAuthorization(didContract, providers, digestFactory),
    ).resolves.toEqual([signature, 12n]);

    expect(requirePrivateState).toHaveBeenCalledWith(providers);
    expect(requireDeployedMidnightDIDLedgerState).toHaveBeenCalledWith(
      providers,
      didContract,
    );
    expect(digestFactory).toHaveBeenCalledWith(ledgerState);
    expect(signControllerAuthorization).toHaveBeenCalledWith(
      privateState.secretKey,
      digest,
    );
  });

  it("signs against a known preflight state without querying a newer version", async () => {
    const { signControllerAuthorization } =
      await import("@midnight-ntwrk/midnight-did-contract");
    const privateState = { secretKey: new Uint8Array([7, 8, 9]) };
    const ledgerState = { id: "did-id", version: 12n };
    const digest = [1n, 2n, 3n, 4n] as const;
    vi.mocked(requirePrivateState).mockResolvedValue(privateState as any);

    await createControllerAuthorization(
      {} as any,
      {} as any,
      () => digest as any,
      ledgerState as any,
    );

    expect(requireDeployedMidnightDIDLedgerState).not.toHaveBeenCalled();
    expect(signControllerAuthorization).toHaveBeenCalledWith(
      privateState.secretKey,
      digest,
    );
  });

  it("propagates missing private state without signing", async () => {
    const failure = new Error("controller secret unavailable");
    vi.mocked(requirePrivateState).mockRejectedValue(failure);

    await expect(
      createControllerAuthorization({} as any, {} as any, () => [
        1n,
        2n,
        3n,
        4n,
      ]),
    ).rejects.toBe(failure);
  });
});
