import {
  deployContract,
  findDeployedContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deploy, joinContract } from "../contract-lifecycle-operations.js";
import { MidnightDIDPrivateStateId } from "../types.js";

vi.mock("@midnight-ntwrk/midnight-js-contracts", () => ({
  deployContract: vi.fn(),
  findDeployedContract: vi.fn(),
}));

vi.mock("../contract-instance.js", () => ({
  midnightDIDCompiledContract: { name: "compiled-midnight-did" },
}));

describe("contract lifecycle operations", () => {
  const contractAddress = "A".repeat(64);
  const deployedContractAddress = "D".repeat(64);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("binds the provider and requires existing private state before joining", async () => {
    const privateState = {
      recoverySecretKey: new Uint8Array(32).fill(9),
      secretKey: new Uint8Array(32).fill(7),
    };
    const privateStateProvider = {
      setContractAddress: vi.fn(),
      get: vi.fn(async () => privateState),
    };
    const joinedContract = {
      deployTxData: { public: { contractAddress } },
    };
    vi.mocked(findDeployedContract).mockResolvedValue(joinedContract as any);

    await expect(
      joinContract({ privateStateProvider } as any, contractAddress),
    ).resolves.toBe(joinedContract);

    expect(privateStateProvider.setContractAddress).toHaveBeenCalledWith(
      contractAddress.toLowerCase(),
    );
    expect(
      privateStateProvider.setContractAddress.mock.invocationCallOrder[0],
    ).toBeLessThan(privateStateProvider.get.mock.invocationCallOrder[0]);
    expect(privateStateProvider.get.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(findDeployedContract).mock.invocationCallOrder[0],
    );
    expect(privateStateProvider.get).toHaveBeenCalledWith(
      MidnightDIDPrivateStateId,
    );
    expect(findDeployedContract).toHaveBeenCalledWith(
      { privateStateProvider },
      expect.objectContaining({
        contractAddress: contractAddress.toLowerCase(),
        privateStateId: MidnightDIDPrivateStateId,
        initialPrivateState: privateState,
      }),
    );
  });

  it("joins with recovery-only private state for controller recovery", async () => {
    const privateState = {
      recoverySecretKey: new Uint8Array(32).fill(9),
    };
    const privateStateProvider = {
      setContractAddress: vi.fn(),
      get: vi.fn(async () => privateState),
    };
    const joinedContract = {
      deployTxData: { public: { contractAddress } },
    };
    vi.mocked(findDeployedContract).mockResolvedValue(joinedContract as any);

    await expect(
      joinContract({ privateStateProvider } as any, contractAddress),
    ).resolves.toBe(joinedContract);

    expect(findDeployedContract).toHaveBeenCalledWith(
      { privateStateProvider },
      expect.objectContaining({ initialPrivateState: privateState }),
    );
  });

  it("does not join a contract when controller and recovery private state are missing", async () => {
    const privateStateProvider = {
      setContractAddress: vi.fn(),
      get: vi.fn(async () => null),
    };

    await expect(
      joinContract({ privateStateProvider } as any, contractAddress),
    ).rejects.toThrow(/private state is missing or malformed/);

    expect(findDeployedContract).not.toHaveBeenCalled();
  });

  it("binds and persists private state after deployment", async () => {
    const privateState = {
      recoverySecretKey: new Uint8Array(32).fill(9),
      secretKey: new Uint8Array(32).fill(8),
    };
    const privateStateProvider = {
      setContractAddress: vi.fn(),
      set: vi.fn(async () => undefined),
    };
    const deployedContract = {
      deployTxData: { public: { contractAddress: deployedContractAddress } },
    };
    vi.mocked(deployContract).mockResolvedValue(deployedContract as any);

    await expect(
      deploy({ privateStateProvider } as any, privateState),
    ).resolves.toBe(deployedContract);

    expect(privateStateProvider.setContractAddress).toHaveBeenCalledWith(
      deployedContractAddress.toLowerCase(),
    );
    expect(privateStateProvider.set).toHaveBeenCalledWith(
      MidnightDIDPrivateStateId,
      privateState,
    );
  });
});
