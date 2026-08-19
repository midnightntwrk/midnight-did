import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createControllerAuthorization: vi.fn(),
  asSchnorrJubjubDigest: vi.fn((digest) => digest),
  serviceToLedger: vi.fn(),
  normalizeBoundDIDURL: vi.fn(),
  findExistingServiceLedgerId: vi.fn(),
  ledgerIdentifier: vi.fn((_, canonical) => ({ canonical })),
  requireExistingServiceLedgerId: vi.fn(),
  requireDeployedMidnightDIDLedgerState: vi.fn(),
  setServiceAuthorizationDigest: vi.fn(() => [1n, 2n, 3n, 4n]),
  removeServiceAuthorizationDigest: vi.fn(() => [5n, 6n, 7n, 8n]),
}));

vi.mock("@midnight-ntwrk/midnight-did-contract", () => ({
  DIDContract: {
    MapMutation: { Insert: "insert", Update: "update" },
    pureCircuits: {
      setServiceAuthorizationDigest: mocks.setServiceAuthorizationDigest,
      removeServiceAuthorizationDigest: mocks.removeServiceAuthorizationDigest,
    },
  },
}));

vi.mock("../controller-authorization.js", () => ({
  asSchnorrJubjubDigest: mocks.asSchnorrJubjubDigest,
  createControllerAuthorization: mocks.createControllerAuthorization,
}));

vi.mock("../did-subject.js", () => ({
  normalizeBoundDIDURL: mocks.normalizeBoundDIDURL,
}));

vi.mock("../ledger-identifier-keys.js", () => ({
  findExistingServiceLedgerId: mocks.findExistingServiceLedgerId,
  ledgerIdentifier: mocks.ledgerIdentifier,
  requireExistingServiceLedgerId: mocks.requireExistingServiceLedgerId,
}));

vi.mock("../ledger-mappers.js", () => ({
  serviceToLedger: mocks.serviceToLedger,
}));

vi.mock("../ledger-state.js", () => ({
  requireDeployedMidnightDIDLedgerState:
    mocks.requireDeployedMidnightDIDLedgerState,
}));

import {
  addService,
  removeService,
  updateService,
} from "../service-operations.js";

const signature = { announcement: { x: 1n, y: 2n }, response: 3n };
const didContract = {
  callTx: {
    setService: vi.fn(async () => ({ public: { txId: "set" } })),
    removeService: vi.fn(async () => ({ public: { txId: "remove" } })),
  },
} as any;
const providers = { privateStateProvider: {} } as any;
const didState = {};
const service = { id: "#service", serviceEndpoint: "https://example.test" };
const ledgerService = {
  id: "did:midnight:example#service",
  serviceEndpoint: "https://example.test",
};
const legacyLedgerService = { ...ledgerService, id: "#service" };

describe("service operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.serviceToLedger.mockReturnValue(ledgerService);
    mocks.normalizeBoundDIDURL.mockReturnValue("did:midnight:example#service");
    mocks.findExistingServiceLedgerId.mockReturnValue(null);
    mocks.requireExistingServiceLedgerId.mockReturnValue("#service");
    mocks.requireDeployedMidnightDIDLedgerState.mockResolvedValue(didState);
    mocks.createControllerAuthorization.mockImplementation(
      async (_didContract, _providers, digestFactory) => {
        digestFactory({ id: "did-id", version: 4n });
        return [signature, 9n];
      },
    );
  });

  it("adds a service with an insert authorization", async () => {
    await expect(
      addService(didContract, providers, service as any),
    ).resolves.toEqual({
      txId: "set",
    });

    expect(mocks.serviceToLedger).toHaveBeenCalledWith(didContract, service);
    expect(mocks.setServiceAuthorizationDigest).toHaveBeenCalledWith(
      "did-id",
      4n,
      ledgerService,
      "insert",
    );
    expect(didContract.callTx.setService).toHaveBeenCalledWith(
      ledgerService,
      "insert",
      signature,
      9n,
    );
  });

  it("updates a service with an update authorization", async () => {
    await expect(
      updateService(didContract, providers, service as any),
    ).resolves.toEqual({ txId: "set" });

    expect(mocks.setServiceAuthorizationDigest).toHaveBeenCalledWith(
      "did-id",
      4n,
      legacyLedgerService,
      "update",
    );
    expect(didContract.callTx.setService).toHaveBeenCalledWith(
      legacyLedgerService,
      "update",
      signature,
      9n,
    );
    expect(mocks.createControllerAuthorization).toHaveBeenCalledWith(
      didContract,
      providers,
      expect.any(Function),
      didState,
    );
  });

  it("normalizes and removes a service", async () => {
    await expect(
      removeService(didContract, providers, "did:midnight:example#service"),
    ).resolves.toEqual({ txId: "remove" });

    expect(mocks.normalizeBoundDIDURL).toHaveBeenCalledWith(
      didContract,
      "did:midnight:example#service",
      "serviceId",
    );
    expect(mocks.removeServiceAuthorizationDigest).toHaveBeenCalledWith(
      "did-id",
      4n,
      "#service",
    );
    expect(didContract.callTx.removeService).toHaveBeenCalledWith(
      "#service",
      signature,
      9n,
    );
  });
});
