import { VerificationMethodRelationType } from "@midnight-ntwrk/midnight-did-domain";
import {
  getNetworkId,
  setNetworkId,
} from "@midnight-ntwrk/midnight-js-network-id";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createControllerAuthorization: vi.fn(async () => [
    { announcement: { x: 1n, y: 2n }, response: 3n },
    7n,
  ]),
  registeredContractProviders: vi.fn(),
  purgeVerificationMethodFromAllRelations: vi.fn(),
  assertExistingVerificationMethodRelationsCompatible: vi.fn(),
  assertVerificationMethodRelationAbsent: vi.fn(),
  assertVerificationMethodRelationCompatible: vi.fn(),
  assertVerificationMethodRelationPresent: vi.fn(),
  requireDeployedMidnightDIDLedgerState: vi.fn(),
  schnorrJubjubVerificationMethodToLedger: vi.fn(),
  verificationMethodToLedger: vi.fn(),
}));

vi.mock("@midnight-ntwrk/midnight-did-contract", () => ({
  DIDContract: {
    MapMutation: { Insert: "insert", Update: "update" },
    SetMutation: { Insert: "insert", Remove: "remove" },
    pureCircuits: {
      removeSchnorrJubjubVerificationMethodAuthorizationDigest: vi.fn(),
      removeVerificationMethodAuthorizationDigest: vi.fn(),
      setSchnorrJubjubVerificationMethodAuthorizationDigest: vi.fn(),
      setVerificationMethodAuthorizationDigest: vi.fn(),
      setVerificationMethodRelationAuthorizationDigest: vi.fn(),
    },
  },
}));

vi.mock("../controller-authorization.js", () => ({
  asSchnorrJubjubDigest: (digest: unknown) => digest,
  createControllerAuthorization: mocks.createControllerAuthorization,
}));

vi.mock("../contract-provider-registry.js", () => ({
  registeredContractProviders: mocks.registeredContractProviders,
}));

vi.mock("../ledger-mappers.js", () => ({
  LedgerVerificationMethodRelationMap: {
    Authentication: "authentication",
  },
  schnorrJubjubVerificationMethodToLedger:
    mocks.schnorrJubjubVerificationMethodToLedger,
  verificationMethodToLedger: mocks.verificationMethodToLedger,
}));

vi.mock("../ledger-state.js", () => ({
  requireDeployedMidnightDIDLedgerState:
    mocks.requireDeployedMidnightDIDLedgerState,
}));

vi.mock("../verification-method-relations.js", () => ({
  assertExistingVerificationMethodRelationsCompatible:
    mocks.assertExistingVerificationMethodRelationsCompatible,
  assertVerificationMethodRelationAbsent:
    mocks.assertVerificationMethodRelationAbsent,
  assertVerificationMethodRelationCompatible:
    mocks.assertVerificationMethodRelationCompatible,
  assertVerificationMethodRelationPresent:
    mocks.assertVerificationMethodRelationPresent,
  purgeVerificationMethodFromAllRelations:
    mocks.purgeVerificationMethodFromAllRelations,
}));

import { getDidSubject } from "../did-subject.js";
import { type DeployedMidnightDIDContract } from "../types.js";
import {
  addVerificationMethodRelation,
  removeSchnorrJubjubVerificationMethod,
  removeVerificationMethod,
  removeVerificationMethodRelation,
  updateSchnorrJubjubVerificationMethod,
  updateVerificationMethod,
  verifySchnorrJubjubDigestSignature,
} from "../verification-method-operations.js";

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
    removeSchnorrJubjubVerificationMethod: vi.fn(async () => ({
      public: { txId: "remove-schnorr" },
    })),
    removeVerificationMethod: vi.fn(async () => ({
      public: { txId: "remove" },
    })),
    setSchnorrJubjubVerificationMethod: vi.fn(async () => ({
      public: { txId: "update-schnorr" },
    })),
    setVerificationMethod: vi.fn(async () => ({
      public: { txId: "update" },
    })),
    setVerificationMethodRelation: vi.fn(async () => ({
      public: { txId: "relation" },
    })),
    verifySchnorrJubjubDigestSignature: vi.fn(async () => ({
      public: { txId: "0x1" },
    })),
  },
} as unknown as DeployedMidnightDIDContract;
const providers = {} as any;
const emptySet = { member: () => false };
const stateWithMethod = (
  methodId: string,
  kind: "opaque" | "schnorrJubjub" = "schnorrJubjub",
) =>
  ({
    verificationMethods: {
      member: (candidate: string) =>
        kind === "opaque" && candidate === methodId,
    },
    schnorrJubjubVerificationMethods: {
      member: (candidate: string) =>
        kind === "schnorrJubjub" && candidate === methodId,
    },
    authenticationRelation: emptySet,
    assertionMethodRelation: emptySet,
    keyAgreementRelation: emptySet,
    capabilityInvocationRelation: emptySet,
    capabilityDelegationRelation: emptySet,
  }) as any;

describe("verification method operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.registeredContractProviders.mockReset();
  });

  it("updates an existing legacy fragment-keyed verification method", async () => {
    const didSubject = getDidSubject(didContract);
    const canonicalMethod = {
      id: `${didSubject}#key-1`,
      publicKeyJwk: { crv: "Ed25519" },
    };
    mocks.verificationMethodToLedger.mockReturnValue(canonicalMethod);
    const didState = stateWithMethod("#key-1", "opaque");
    mocks.requireDeployedMidnightDIDLedgerState.mockResolvedValue(didState);

    await expect(
      updateVerificationMethod(didContract, providers, {
        publicKeyJwk: { crv: "Ed25519" },
      } as any),
    ).resolves.toEqual({ txId: "update" });

    expect(didContract.callTx.setVerificationMethod).toHaveBeenCalledWith(
      { ...canonicalMethod, id: "#key-1" },
      expect.anything(),
      expect.anything(),
      7n,
    );
    expect(
      mocks.assertExistingVerificationMethodRelationsCompatible,
    ).toHaveBeenCalledWith(expect.anything(), "Ed25519", "#key-1");
    expect(mocks.createControllerAuthorization).toHaveBeenCalledWith(
      didContract,
      providers,
      expect.any(Function),
      didState,
    );
  });

  it("rejects ambiguous canonical and legacy method records before authorization", async () => {
    const didSubject = getDidSubject(didContract);
    mocks.verificationMethodToLedger.mockReturnValue({
      id: `${didSubject}#key-1`,
      publicKeyJwk: { crv: "Ed25519" },
    });
    mocks.requireDeployedMidnightDIDLedgerState.mockResolvedValue({
      ...stateWithMethod("#key-1", "opaque"),
      verificationMethods: {
        member: (candidate: string) =>
          candidate === "#key-1" || candidate === `${didSubject}#key-1`,
      },
    });

    await expect(
      updateVerificationMethod(didContract, providers, {
        publicKeyJwk: { crv: "Ed25519" },
      } as any),
    ).rejects.toThrow(/Ambiguous verification method identifier/);
    expect(mocks.createControllerAuthorization).not.toHaveBeenCalled();
  });

  it("updates and removes a legacy SchnorrJubjub method by its physical key", async () => {
    const didSubject = getDidSubject(didContract);
    mocks.schnorrJubjubVerificationMethodToLedger.mockReturnValue({
      id: `${didSubject}#jubjub-1`,
      publicKey: { x: 1n, y: 2n },
    });
    const didState = stateWithMethod("#jubjub-1");
    mocks.requireDeployedMidnightDIDLedgerState.mockResolvedValue(didState);

    await expect(
      updateSchnorrJubjubVerificationMethod(didContract, providers, {
        id: `${didSubject}#jubjub-1`,
        publicKey: { x: 1n, y: 2n },
      }),
    ).resolves.toEqual({ txId: "update-schnorr" });
    expect(
      didContract.callTx.setSchnorrJubjubVerificationMethod,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ id: "#jubjub-1" }),
      expect.anything(),
      expect.anything(),
      7n,
    );
    expect(mocks.createControllerAuthorization).toHaveBeenLastCalledWith(
      didContract,
      providers,
      expect.any(Function),
      didState,
    );

    await expect(
      removeSchnorrJubjubVerificationMethod(
        didContract,
        providers,
        `${didSubject}#jubjub-1`,
      ),
    ).resolves.toEqual({ txId: "remove-schnorr" });
    expect(mocks.purgeVerificationMethodFromAllRelations).toHaveBeenCalledWith(
      didContract,
      providers,
      "#jubjub-1",
    );
    expect(
      didContract.callTx.removeSchnorrJubjubVerificationMethod,
    ).toHaveBeenCalledWith("#jubjub-1", expect.anything(), 7n);
  });

  it("removes and purges relations by the existing legacy ledger key", async () => {
    const didSubject = getDidSubject(didContract);
    mocks.requireDeployedMidnightDIDLedgerState.mockResolvedValue(
      stateWithMethod("#key-1", "opaque"),
    );

    await expect(
      removeVerificationMethod(didContract, providers, `${didSubject}#key-1`),
    ).resolves.toEqual({ txId: "remove" });

    expect(mocks.purgeVerificationMethodFromAllRelations).toHaveBeenCalledWith(
      didContract,
      providers,
      "#key-1",
    );
    expect(didContract.callTx.removeVerificationMethod).toHaveBeenCalledWith(
      "#key-1",
      expect.anything(),
      7n,
    );
  });

  it("adds a relation using the existing legacy verification-method key", async () => {
    const didSubject = getDidSubject(didContract);
    mocks.requireDeployedMidnightDIDLedgerState.mockResolvedValue(
      stateWithMethod("#key-1", "opaque"),
    );

    await expect(
      addVerificationMethodRelation(
        didContract,
        providers,
        VerificationMethodRelationType.Authentication,
        `${didSubject}#key-1`,
      ),
    ).resolves.toEqual({ txId: "relation" });

    expect(
      mocks.assertVerificationMethodRelationCompatible,
    ).toHaveBeenCalledWith(
      expect.anything(),
      VerificationMethodRelationType.Authentication,
      "#key-1",
    );
    expect(
      didContract.callTx.setVerificationMethodRelation,
    ).toHaveBeenCalledWith(
      expect.anything(),
      "#key-1",
      expect.anything(),
      expect.anything(),
      7n,
    );
  });

  it("removes a relation using the existing legacy verification-method key", async () => {
    const didSubject = getDidSubject(didContract);
    const didState = stateWithMethod("#key-1", "opaque");
    mocks.requireDeployedMidnightDIDLedgerState.mockResolvedValue(didState);

    await expect(
      removeVerificationMethodRelation(
        didContract,
        providers,
        VerificationMethodRelationType.Authentication,
        `${didSubject}#key-1`,
      ),
    ).resolves.toEqual({ txId: "relation" });

    expect(mocks.assertVerificationMethodRelationPresent).toHaveBeenCalledWith(
      didState,
      VerificationMethodRelationType.Authentication,
      "#key-1",
    );
    expect(
      didContract.callTx.setVerificationMethodRelation,
    ).toHaveBeenCalledWith(
      expect.anything(),
      "#key-1",
      expect.anything(),
      expect.anything(),
      7n,
    );
    expect(mocks.createControllerAuthorization).toHaveBeenCalledWith(
      didContract,
      providers,
      expect.any(Function),
      didState,
    );
  });

  it.each([
    ["canonical", (didSubject: string) => `${didSubject}#key-1`],
    ["legacy", () => "#key-1"],
  ])(
    "verifies SchnorrJubjub signatures against the existing %s ledger key",
    async (_kind, existingMethodId) => {
      const didSubject = getDidSubject(didContract);
      const digest = [1n, 2n, 3n, 4n] as [bigint, bigint, bigint, bigint];
      const signature = {
        announcement: { x: 5n, y: 6n },
        response: 7n,
      };

      const ledgerMethodId = existingMethodId(didSubject);
      mocks.requireDeployedMidnightDIDLedgerState.mockResolvedValue(
        stateWithMethod(ledgerMethodId),
      );

      await expect(
        verifySchnorrJubjubDigestSignature(
          didContract,
          providers,
          `${didSubject}#key-1`,
          digest,
          signature,
        ),
      ).resolves.toEqual({ txId: "0x1" });

      expect(
        didContract.callTx.verifySchnorrJubjubDigestSignature,
      ).toHaveBeenCalledWith(ledgerMethodId, digest, signature);
    },
  );

  it.each([
    ["canonical API-created", (didSubject: string) => `${didSubject}#key-1`],
    ["legacy-only", () => "#key-1"],
  ])(
    "uses associated provider state for the deprecated verifier with a %s key",
    async (_label, existingMethodId) => {
      const didSubject = getDidSubject(didContract);
      const digest = [1n, 2n, 3n, 4n] as [bigint, bigint, bigint, bigint];
      const signature = {
        announcement: { x: 5n, y: 6n },
        response: 7n,
      };
      const ledgerMethodId = existingMethodId(didSubject);
      mocks.registeredContractProviders.mockReturnValue(providers);
      mocks.requireDeployedMidnightDIDLedgerState.mockResolvedValue(
        stateWithMethod(ledgerMethodId),
      );

      await expect(
        verifySchnorrJubjubDigestSignature(
          didContract,
          `${didSubject}#key-1`,
          digest,
          signature,
        ),
      ).resolves.toEqual({ txId: "0x1" });

      expect(mocks.requireDeployedMidnightDIDLedgerState).toHaveBeenCalledWith(
        providers,
        didContract,
      );
      expect(
        didContract.callTx.verifySchnorrJubjubDigestSignature,
      ).toHaveBeenCalledWith(ledgerMethodId, digest, signature);
    },
  );

  it("fails the deprecated verifier when an associated ledger key is absent", async () => {
    const didSubject = getDidSubject(didContract);
    mocks.registeredContractProviders.mockReturnValue(providers);
    mocks.requireDeployedMidnightDIDLedgerState.mockResolvedValue(
      stateWithMethod("#another-key"),
    );

    await expect(
      verifySchnorrJubjubDigestSignature(
        didContract,
        `${didSubject}#key-1`,
        [1n, 2n, 3n, 4n],
        { announcement: { x: 5n, y: 6n }, response: 7n },
      ),
    ).rejects.toThrow(/verification method .* does not exist/);

    expect(
      didContract.callTx.verifySchnorrJubjubDigestSignature,
    ).not.toHaveBeenCalled();
  });

  it("fails closed when deprecated verification finds canonical and legacy entries", async () => {
    const didSubject = getDidSubject(didContract);
    mocks.registeredContractProviders.mockReturnValue(providers);
    mocks.requireDeployedMidnightDIDLedgerState.mockResolvedValue({
      ...stateWithMethod("#key-1"),
      schnorrJubjubVerificationMethods: {
        member: (candidate: string) =>
          candidate === "#key-1" || candidate === `${didSubject}#key-1`,
      },
    });

    await expect(
      verifySchnorrJubjubDigestSignature(
        didContract,
        `${didSubject}#key-1`,
        [1n, 2n, 3n, 4n],
        { announcement: { x: 5n, y: 6n }, response: 7n },
      ),
    ).rejects.toThrow(/Ambiguous verification method identifier/);

    expect(
      didContract.callTx.verifySchnorrJubjubDigestSignature,
    ).not.toHaveBeenCalled();
  });

  it("preserves the historical four-argument fallback for unregistered handles", async () => {
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

    expect(mocks.requireDeployedMidnightDIDLedgerState).not.toHaveBeenCalled();
    expect(
      didContract.callTx.verifySchnorrJubjubDigestSignature,
    ).toHaveBeenCalledWith("#key-1", digest, signature);
  });
});
