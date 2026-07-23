import { MidnightDIDResolver } from "@midnight-ntwrk/midnight-did";
import { parseContractAddress } from "@midnight-ntwrk/midnight-did/midnight";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDidSubject, getMidnightNetwork } from "../did-subject.js";
import { getMidnightDIDLedgerState } from "../ledger-state.js";
import { resolveDIDResolutionResult } from "../resolution.js";

const midnightDidMocks = vi.hoisted(() => {
  const state = {
    options: undefined as
      | {
          expectedNetwork?: string;
          ledgerReader: (contractAddress: string) => Promise<unknown>;
        }
      | undefined,
    resolveResult: vi.fn(),
  };
  const resolver = vi.fn(function (options) {
    state.options = options;
    return { resolveResult: state.resolveResult };
  });
  return { resolver, state };
});

vi.mock("@midnight-ntwrk/midnight-did", () => ({
  MidnightDIDResolver: midnightDidMocks.resolver,
}));

vi.mock("@midnight-ntwrk/midnight-did/midnight", () => ({
  parseContractAddress: vi.fn((value: string) => value),
}));

vi.mock("../did-subject.js", () => ({
  getDidSubject: vi.fn(() => `did:midnight:devnet:${"a".repeat(64)}`),
  getMidnightNetwork: vi.fn(() => "devnet"),
}));

vi.mock("../ledger-state.js", () => ({
  getMidnightDIDLedgerState: vi.fn(),
}));

const didContract = {
  deployTxData: {
    public: {
      contractAddress: "a".repeat(64),
    },
  },
};

describe("resolution helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    midnightDidMocks.state.options = undefined;
  });

  it("returns a DID Core resolution envelope on success", async () => {
    const didDocument = {
      "@context": "https://www.w3.org/ns/did/v1",
      id: `did:midnight:devnet:${"a".repeat(64)}`,
    };
    const didDocumentMetadata = { versionId: "1" };

    midnightDidMocks.state.resolveResult.mockResolvedValue({
      didDocument,
      didDocumentMetadata,
    });

    const result = await resolveDIDResolutionResult(
      {} as never,
      didContract as never,
    );

    expect(MidnightDIDResolver).toHaveBeenCalledWith({
      expectedNetwork: "devnet",
      ledgerReader: expect.any(Function),
    });
    expect(getDidSubject).toHaveBeenCalledWith(didContract);
    expect(getMidnightNetwork).toHaveBeenCalled();
    expect(midnightDidMocks.state.resolveResult).toHaveBeenCalledWith(
      `did:midnight:devnet:${"a".repeat(64)}`,
    );
    expect(result).toEqual({
      didDocument,
      didDocumentMetadata,
      didResolutionMetadata: {},
    });
  });

  it("adapts resolver ledger reads to the API public data provider", async () => {
    const providers = {} as never;
    const ledgerState = { version: 1n };

    midnightDidMocks.state.resolveResult.mockResolvedValue(null);
    vi.mocked(getMidnightDIDLedgerState).mockResolvedValue(
      ledgerState as never,
    );

    await resolveDIDResolutionResult(providers, didContract as never);
    const result = await midnightDidMocks.state.options?.ledgerReader(
      "b".repeat(64),
    );

    expect(parseContractAddress).toHaveBeenCalledWith("b".repeat(64));
    expect(getMidnightDIDLedgerState).toHaveBeenCalledWith(
      providers,
      "b".repeat(64),
    );
    expect(result).toBe(ledgerState);
  });

  it("returns notFound when the contract state is missing", async () => {
    midnightDidMocks.state.resolveResult.mockResolvedValue(null);

    const result = await resolveDIDResolutionResult(
      {} as never,
      didContract as never,
    );

    expect(result).toEqual({
      didDocument: null,
      didDocumentMetadata: {},
      didResolutionMetadata: { error: "notFound" },
    });
  });
});
