import { unshieldedToken } from "@midnight-ntwrk/ledger-v8";
import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import {
  CurveType,
  KeyType,
  VerificationMethodType,
} from "@midnight-ntwrk/midnight-did-domain";
import {
  getNetworkId,
  setNetworkId,
} from "@midnight-ntwrk/midnight-js-network-id";
import * as Rx from "rxjs";
import { describe, expect, it, vi } from "vitest";

import {
  addVerificationMethod,
  hashProverKey,
  initPrivateState,
  randomBytes,
  setLogger,
  waitForFunds,
  waitForSync,
} from "../lib";
import { MissingPrivateStateContractAddressError } from "../midnight-provider-utils";

const logger = {
  info: () => undefined,
} as any;

describe("lib lightweight unit helpers", () => {
  it("maps verification method type to Compact typ field", async () => {
    let previousNetworkId: string | undefined;
    try {
      previousNetworkId = getNetworkId();
    } catch {
      previousNetworkId = undefined;
    }
    setNetworkId("undeployed");
    const contractAddress = "a".repeat(64);
    const didSubject = `did:midnight:undeployed:${contractAddress}`;
    const finalized = { txId: "tx-typ-round-trip" };
    const addVerificationMethodMock = vi.fn().mockResolvedValue({
      public: finalized,
    });
    const didContract = {
      deployTxData: {
        public: { contractAddress },
      },
      callTx: {
        addVerificationMethod: addVerificationMethodMock,
      },
    } as any;

    try {
      const result = await addVerificationMethod(didContract, {
        id: `${didSubject}#key-1`,
        type: VerificationMethodType.JsonWebKey,
        controller: didSubject,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          x: "AA",
        },
      });

      expect(result).toBe(finalized);
      expect(addVerificationMethodMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "#key-1",
          typ: DIDContract.VerificationMethodType.JsonWebKey,
          publicKeyJwk: expect.objectContaining({
            kty: DIDContract.KeyType.OKP,
            crv: DIDContract.CurveType.Ed25519,
            x: 0n,
          }),
        }),
      );
      expect(addVerificationMethodMock.mock.calls[0][0]).not.toHaveProperty(
        "type",
      );
    } finally {
      if (previousNetworkId !== undefined) {
        setNetworkId(previousNetworkId);
      }
    }
  });

  it("hashProverKey is deterministic and returns 32 bytes", async () => {
    const input = new Uint8Array([1, 2, 3, 4]);
    const first = await hashProverKey(input);
    const second = await hashProverKey(input);
    expect(first.length).toBe(32);
    expect(Array.from(first)).toEqual(Array.from(second));
  });

  it("randomBytes returns requested length", () => {
    const bytes = randomBytes(32);
    expect(bytes).toHaveLength(32);
  });

  it("waitForSync resolves when wallet state is synced", async () => {
    setLogger(logger);
    const wallet = {
      state: () => Rx.of({ isSynced: true }),
    } as any;

    const state = await waitForSync(wallet);
    expect(state.isSynced).toBe(true);
  });

  it("waitForFunds resolves to positive unshielded balance", async () => {
    setLogger(logger);
    const token = unshieldedToken().raw;
    const wallet = {
      state: () =>
        Rx.of({
          isSynced: true,
          unshielded: { balances: { [token]: 42n } },
        }),
    } as any;

    const balance = await waitForFunds(wallet);
    expect(balance).toBe(42n);
  });

  it("skips private state IO only for the provider missing-contract-address error", async () => {
    setLogger(logger);
    const providerError = new MissingPrivateStateContractAddressError("get");
    const providers = {
      privateStateProvider: {
        get: vi.fn().mockRejectedValue(providerError),
        set: vi
          .fn()
          .mockRejectedValue(
            new MissingPrivateStateContractAddressError("set"),
          ),
      },
      zkConfigProvider: {
        getProverKey: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      },
    } as any;

    const privateState = await initPrivateState(providers);

    expect(privateState.secretKey).toHaveLength(32);
    expect(providers.zkConfigProvider.getProverKey).toHaveBeenCalledWith(
      "addVerificationMethod",
    );
  });

  it("does not swallow unrelated private-state provider errors", async () => {
    setLogger(logger);
    const providers = {
      privateStateProvider: {
        get: vi.fn().mockRejectedValue(new Error("audit cache failed")),
        set: vi.fn(),
      },
      zkConfigProvider: {
        getProverKey: vi.fn(),
      },
    } as any;

    await expect(initPrivateState(providers)).rejects.toThrow("audit cache");
    expect(providers.zkConfigProvider.getProverKey).not.toHaveBeenCalled();
  });
});
