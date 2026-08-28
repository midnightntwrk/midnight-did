import { VerificationMethodRelationType } from "@midnight-ntwrk/midnight-did-domain";
import {
  getNetworkId,
  setNetworkId,
} from "@midnight-ntwrk/midnight-js-network-id";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createControllerAuthorization: vi.fn(
    async (
      _contract: unknown,
      _providers: unknown,
      digest: (ledgerState: unknown) => unknown,
      ledgerState: unknown,
    ) => {
      digest(ledgerState);
      return [{ announcement: { x: 1n, y: 2n }, response: 3n }, 7n];
    },
  ),
  registeredContractProviders: vi.fn(),
  assertVerificationMethodIsNotReferenced: vi.fn(),
  assertExistingVerificationMethodRelationsCompatible: vi.fn(),
  assertVerificationMethodRelationAbsent: vi.fn(),
  assertVerificationMethodRelationCompatible: vi.fn(),
  assertVerificationMethodRelationPresent: vi.fn(),
  requireDeployedMidnightDIDLedgerState: vi.fn(),
  schnorrJubjubVerificationMethodToLedger: vi.fn(),
  verificationMethodToLedger: vi.fn(),
  removeSchnorrJubjubVerificationMethodAuthorizationDigest: vi.fn(
    (...args: unknown[]) => args,
  ),
  removeVerificationMethodAuthorizationDigest: vi.fn(
    (...args: unknown[]) => args,
  ),
  setSchnorrJubjubVerificationMethodAuthorizationDigest: vi.fn(
    (...args: unknown[]) => args,
  ),
  setVerificationMethodAuthorizationDigest: vi.fn((...args: unknown[]) => args),
  setVerificationMethodRelationAuthorizationDigest: vi.fn(
    (...args: unknown[]) => args,
  ),
}));

vi.mock("@midnight-ntwrk/midnight-did-contract", () => ({
  DIDContract: {
    MapMutation: { Insert: "insert", Update: "update" },
    SetMutation: { Insert: "insert", Remove: "remove" },
    pureCircuits: {
      removeSchnorrJubjubVerificationMethodAuthorizationDigest:
        mocks.removeSchnorrJubjubVerificationMethodAuthorizationDigest,
      removeVerificationMethodAuthorizationDigest:
        mocks.removeVerificationMethodAuthorizationDigest,
      setSchnorrJubjubVerificationMethodAuthorizationDigest:
        mocks.setSchnorrJubjubVerificationMethodAuthorizationDigest,
      setVerificationMethodAuthorizationDigest:
        mocks.setVerificationMethodAuthorizationDigest,
      setVerificationMethodRelationAuthorizationDigest:
        mocks.setVerificationMethodRelationAuthorizationDigest,
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
  assertVerificationMethodIsNotReferenced:
    mocks.assertVerificationMethodIsNotReferenced,
}));

import { getDidSubject } from "../did-subject.js";
import { type DeployedMidnightDIDContract } from "../types.js";
import {
  addSchnorrJubjubVerificationMethod,
  addVerificationMethod,
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
    id: "ledger-id",
    version: 12n,
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

  it("adds opaque and SchnorrJubjub methods with insert authorization bound to current state", async () => {
    const didSubject = getDidSubject(didContract);
    const opaqueMethod = {
      id: `${didSubject}#key-1`,
      publicKeyJwk: { crv: "Ed25519" },
    };
    const schnorrMethod = {
      id: `${didSubject}#jubjub-1`,
      publicKey: { x: 1n, y: 2n },
    };
    const didState = stateWithMethod("#absent", "opaque");
    mocks.requireDeployedMidnightDIDLedgerState.mockResolvedValue(didState);
    mocks.verificationMethodToLedger.mockReturnValue(opaqueMethod);
    mocks.schnorrJubjubVerificationMethodToLedger.mockReturnValue(
      schnorrMethod,
    );

    await expect(
      addVerificationMethod(didContract, providers, opaqueMethod as never),
    ).resolves.toEqual({ txId: "update" });
    expect(mocks.setVerificationMethodAuthorizationDigest).toHaveBeenCalledWith(
      "ledger-id",
      12n,
      opaqueMethod,
      "insert",
    );
    expect(didContract.callTx.setVerificationMethod).toHaveBeenCalledWith(
      opaqueMethod,
      "insert",
      { announcement: { x: 1n, y: 2n }, response: 3n },
      7n,
    );

    await expect(
      addSchnorrJubjubVerificationMethod(didContract, providers, schnorrMethod),
    ).resolves.toEqual({ txId: "update-schnorr" });
    expect(
      mocks.setSchnorrJubjubVerificationMethodAuthorizationDigest,
    ).toHaveBeenCalledWith("ledger-id", 12n, schnorrMethod, "insert");
    expect(
      didContract.callTx.setSchnorrJubjubVerificationMethod,
    ).toHaveBeenCalledWith(
      schnorrMethod,
      "insert",
      { announcement: { x: 1n, y: 2n }, response: 3n },
      7n,
    );
  });

  it.each([
    ["opaque", addVerificationMethod, "setVerificationMethod"],
    [
      "SchnorrJubjub",
      addSchnorrJubjubVerificationMethod,
      "setSchnorrJubjubVerificationMethod",
    ],
  ] as const)(
    "rejects duplicate %s additions before authorization or submission",
    async (kind, add, callName) => {
      const didSubject = getDidSubject(didContract);
      const methodId = kind === "opaque" ? "#key-1" : "#jubjub-1";
      const ledgerMethod =
        kind === "opaque"
          ? {
              id: `${didSubject}${methodId}`,
              publicKeyJwk: { crv: "Ed25519" },
            }
          : {
              id: `${didSubject}${methodId}`,
              publicKey: { x: 1n, y: 2n },
            };
      mocks.requireDeployedMidnightDIDLedgerState.mockResolvedValue(
        stateWithMethod(
          `${didSubject}${methodId}`,
          kind === "opaque" ? "opaque" : "schnorrJubjub",
        ),
      );
      if (kind === "opaque") {
        mocks.verificationMethodToLedger.mockReturnValue(ledgerMethod);
      } else {
        mocks.schnorrJubjubVerificationMethodToLedger.mockReturnValue(
          ledgerMethod,
        );
      }

      await expect(
        add(didContract, providers, ledgerMethod as never),
      ).rejects.toThrow(/already exists/);
      expect(mocks.createControllerAuthorization).not.toHaveBeenCalled();
      expect(didContract.callTx[callName]).not.toHaveBeenCalled();
    },
  );

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
    expect(mocks.setVerificationMethodAuthorizationDigest).toHaveBeenCalledWith(
      "ledger-id",
      12n,
      { ...canonicalMethod, id: "#key-1" },
      "update",
    );
  });

  it("rejects absent, wrong-kind, and relation-incompatible opaque updates before authorization", async () => {
    const didSubject = getDidSubject(didContract);
    const canonicalMethod = {
      id: `${didSubject}#key-1`,
      publicKeyJwk: { crv: "Ed25519" },
    };
    mocks.verificationMethodToLedger.mockReturnValue(canonicalMethod);

    mocks.requireDeployedMidnightDIDLedgerState.mockResolvedValueOnce(
      stateWithMethod("#other", "opaque"),
    );
    await expect(
      updateVerificationMethod(
        didContract,
        providers,
        canonicalMethod as never,
      ),
    ).rejects.toThrow(/does not exist/);

    mocks.requireDeployedMidnightDIDLedgerState.mockResolvedValueOnce(
      stateWithMethod("#key-1", "schnorrJubjub"),
    );
    await expect(
      updateVerificationMethod(
        didContract,
        providers,
        canonicalMethod as never,
      ),
    ).rejects.toThrow(/stored as schnorrJubjub, not opaque/);

    mocks.requireDeployedMidnightDIDLedgerState.mockResolvedValueOnce(
      stateWithMethod("#key-1", "opaque"),
    );
    mocks.assertExistingVerificationMethodRelationsCompatible.mockImplementationOnce(
      () => {
        throw new Error("existing relation is incompatible");
      },
    );
    await expect(
      updateVerificationMethod(
        didContract,
        providers,
        canonicalMethod as never,
      ),
    ).rejects.toThrow(/incompatible/);

    expect(mocks.createControllerAuthorization).not.toHaveBeenCalled();
    expect(didContract.callTx.setVerificationMethod).not.toHaveBeenCalled();
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
    expect(
      mocks.setSchnorrJubjubVerificationMethodAuthorizationDigest,
    ).toHaveBeenCalledWith(
      "ledger-id",
      12n,
      { id: "#jubjub-1", publicKey: { x: 1n, y: 2n } },
      "update",
    );

    await expect(
      removeSchnorrJubjubVerificationMethod(
        didContract,
        providers,
        `${didSubject}#jubjub-1`,
      ),
    ).resolves.toEqual({ txId: "remove-schnorr" });
    expect(mocks.assertVerificationMethodIsNotReferenced).toHaveBeenCalledWith(
      didState,
      "#jubjub-1",
    );
    expect(
      didContract.callTx.removeSchnorrJubjubVerificationMethod,
    ).toHaveBeenCalledWith("#jubjub-1", expect.anything(), 7n);
    expect(
      mocks.removeSchnorrJubjubVerificationMethodAuthorizationDigest,
    ).toHaveBeenCalledWith("ledger-id", 12n, "#jubjub-1");
    expect(
      didContract.callTx.setVerificationMethodRelation,
    ).not.toHaveBeenCalled();
  });

  it("removes an unreferenced method by the existing legacy ledger key without relation submissions", async () => {
    const didSubject = getDidSubject(didContract);
    const didState = stateWithMethod("#key-1", "opaque");
    mocks.requireDeployedMidnightDIDLedgerState.mockResolvedValue(didState);

    await expect(
      removeVerificationMethod(didContract, providers, `${didSubject}#key-1`),
    ).resolves.toEqual({ txId: "remove" });

    expect(mocks.assertVerificationMethodIsNotReferenced).toHaveBeenCalledWith(
      didState,
      "#key-1",
    );
    expect(didContract.callTx.removeVerificationMethod).toHaveBeenCalledWith(
      "#key-1",
      expect.anything(),
      7n,
    );
    expect(
      didContract.callTx.setVerificationMethodRelation,
    ).not.toHaveBeenCalled();
    expect(mocks.createControllerAuthorization).toHaveBeenCalledWith(
      didContract,
      providers,
      expect.any(Function),
      didState,
    );
    expect(
      mocks.removeVerificationMethodAuthorizationDigest,
    ).toHaveBeenCalledWith("ledger-id", 12n, "#key-1");
  });

  it("preflights and removes by the canonical physical ledger id", async () => {
    const didSubject = getDidSubject(didContract);
    const canonicalMethodId = `${didSubject}#key-1`;
    const didState = stateWithMethod(canonicalMethodId, "opaque");
    mocks.requireDeployedMidnightDIDLedgerState.mockResolvedValue(didState);

    await expect(
      removeVerificationMethod(didContract, providers, canonicalMethodId),
    ).resolves.toEqual({ txId: "remove" });

    expect(mocks.assertVerificationMethodIsNotReferenced).toHaveBeenCalledWith(
      didState,
      canonicalMethodId,
    );
    expect(didContract.callTx.removeVerificationMethod).toHaveBeenCalledWith(
      canonicalMethodId,
      expect.anything(),
      7n,
    );
  });

  it.each([
    ["opaque", removeVerificationMethod],
    ["SchnorrJubjub", removeSchnorrJubjubVerificationMethod],
  ])(
    "does not authorize or submit %s removal when relation preflight rejects",
    async (kind, remove) => {
      const didSubject = getDidSubject(didContract);
      const methodId = kind === "opaque" ? "#key-1" : "#jubjub-1";
      mocks.requireDeployedMidnightDIDLedgerState.mockResolvedValue(
        stateWithMethod(
          methodId,
          kind === "opaque" ? "opaque" : "schnorrJubjub",
        ),
      );
      mocks.assertVerificationMethodIsNotReferenced.mockImplementationOnce(
        () => {
          throw new Error("verification method is still referenced");
        },
      );

      await expect(
        remove(didContract, providers, `${didSubject}${methodId}`),
      ).rejects.toThrow(/still referenced/);

      expect(mocks.createControllerAuthorization).not.toHaveBeenCalled();
      expect(
        didContract.callTx.removeVerificationMethod,
      ).not.toHaveBeenCalled();
      expect(
        didContract.callTx.removeSchnorrJubjubVerificationMethod,
      ).not.toHaveBeenCalled();
    },
  );

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
      "authentication",
      "#key-1",
      "insert",
      { announcement: { x: 1n, y: 2n }, response: 3n },
      7n,
    );
    expect(
      mocks.setVerificationMethodRelationAuthorizationDigest,
    ).toHaveBeenCalledWith(
      "ledger-id",
      12n,
      "authentication",
      "#key-1",
      "insert",
    );
  });

  it("rejects duplicate, incompatible, and missing relation mutations before authorization", async () => {
    const didSubject = getDidSubject(didContract);
    mocks.requireDeployedMidnightDIDLedgerState.mockResolvedValue(
      stateWithMethod("#key-1", "opaque"),
    );

    mocks.assertVerificationMethodRelationAbsent.mockImplementationOnce(() => {
      throw new Error("relation already contains method");
    });
    await expect(
      addVerificationMethodRelation(
        didContract,
        providers,
        VerificationMethodRelationType.Authentication,
        `${didSubject}#key-1`,
      ),
    ).rejects.toThrow(/already contains/);

    mocks.assertVerificationMethodRelationCompatible.mockImplementationOnce(
      () => {
        throw new Error("relation is incompatible");
      },
    );
    await expect(
      addVerificationMethodRelation(
        didContract,
        providers,
        VerificationMethodRelationType.Authentication,
        `${didSubject}#key-1`,
      ),
    ).rejects.toThrow(/incompatible/);

    mocks.assertVerificationMethodRelationPresent.mockImplementationOnce(() => {
      throw new Error("relation does not contain method");
    });
    await expect(
      removeVerificationMethodRelation(
        didContract,
        providers,
        VerificationMethodRelationType.Authentication,
        `${didSubject}#key-1`,
      ),
    ).rejects.toThrow(/does not contain/);

    expect(mocks.createControllerAuthorization).not.toHaveBeenCalled();
    expect(
      didContract.callTx.setVerificationMethodRelation,
    ).not.toHaveBeenCalled();
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
      "authentication",
      "#key-1",
      "remove",
      { announcement: { x: 1n, y: 2n }, response: 3n },
      7n,
    );
    expect(
      mocks.setVerificationMethodRelationAuthorizationDigest,
    ).toHaveBeenCalledWith(
      "ledger-id",
      12n,
      "authentication",
      "#key-1",
      "remove",
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
