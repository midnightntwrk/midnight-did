import { MidnightDIDResolver } from "@midnight-ntwrk/midnight-did";
import { parseContractAddress } from "@midnight-ntwrk/midnight-did/midnight";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDidSubject, getMidnightNetwork } from "../did-subject.js";
import { getMidnightDIDLedgerState } from "../ledger-state.js";
import {
  resolve,
  resolveDIDResolutionResult,
  resolveRepresentation,
} from "../resolution.js";

const midnightDidMocks = vi.hoisted(() => {
  const state = {
    options: undefined as
      | {
          expectedNetwork?: string;
          ledgerReader: (contractAddress: string) => Promise<unknown>;
        }
      | undefined,
    resolveResult: vi.fn(),
    resolveDIDResolutionResult: vi.fn(),
    resolveRepresentation: vi.fn(),
  };
  const resolver = vi.fn(function (options) {
    state.options = options;
    return {
      resolveResult: state.resolveResult,
      resolveDIDResolutionResult: state.resolveDIDResolutionResult,
      resolveRepresentation: state.resolveRepresentation,
    };
  });
  return { resolver, state };
});

vi.mock("@midnight-ntwrk/midnight-did", () => ({
  MidnightDIDResolver: midnightDidMocks.resolver,
}));

vi.mock("@midnight-ntwrk/midnight-did/midnight", () => ({
  parseContractAddress: vi.fn((value: string) => value.toLowerCase()),
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
    midnightDidMocks.state.resolveResult.mockReset();
    midnightDidMocks.state.resolveDIDResolutionResult.mockReset();
    midnightDidMocks.state.resolveRepresentation.mockReset();
  });

  it("returns a DID Core resolution envelope on success", async () => {
    const didDocument = {
      "@context": "https://www.w3.org/ns/did/v1",
      id: `did:midnight:devnet:${"a".repeat(64)}`,
    };
    const didDocumentMetadata = { versionId: "1" };

    midnightDidMocks.state.resolveDIDResolutionResult.mockResolvedValue({
      didDocument,
      didDocumentMetadata,
      didResolutionMetadata: {},
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
    expect(
      midnightDidMocks.state.resolveDIDResolutionResult,
    ).toHaveBeenCalledWith(`did:midnight:devnet:${"a".repeat(64)}`);
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
    const mixedCaseAddress = `${"B".repeat(32)}${"c".repeat(32)}`;
    const result =
      await midnightDidMocks.state.options?.ledgerReader(mixedCaseAddress);

    expect(parseContractAddress).toHaveBeenCalledWith(mixedCaseAddress);
    expect(getMidnightDIDLedgerState).toHaveBeenCalledWith(
      providers,
      mixedCaseAddress.toLowerCase(),
    );
    expect(result).toBe(ledgerState);
  });

  it("returns notFound when the contract state is missing", async () => {
    midnightDidMocks.state.resolveDIDResolutionResult.mockResolvedValue({
      didDocument: null,
      didDocumentMetadata: {},
      didResolutionMetadata: { error: "notFound" },
    });

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

  it("preserves resolver error metadata", async () => {
    midnightDidMocks.state.resolveDIDResolutionResult.mockResolvedValue({
      didDocument: null,
      didDocumentMetadata: {},
      didResolutionMetadata: { error: "methodNotSupported" },
    });

    const result = await resolveDIDResolutionResult(
      {} as never,
      didContract as never,
    );

    expect(result.didResolutionMetadata.error).toBe("methodNotSupported");
  });

  it("uses the same resolver wiring for nullable resolution", async () => {
    const didDocument = {
      "@context": "https://www.w3.org/ns/did/v1",
      id: `did:midnight:devnet:${"a".repeat(64)}`,
    };
    const didDocumentMetadata = { versionId: "1" };
    midnightDidMocks.state.resolveResult.mockResolvedValue({
      didDocument,
      didDocumentMetadata,
    });

    const result = await resolve({} as never, didContract as never);

    expect(MidnightDIDResolver).toHaveBeenCalledWith({
      expectedNetwork: "devnet",
      ledgerReader: expect.any(Function),
    });
    expect(midnightDidMocks.state.resolveResult).toHaveBeenCalledWith(
      `did:midnight:devnet:${"a".repeat(64)}`,
    );
    expect(result).toEqual({ didDocument, didDocumentMetadata });
  });

  it("delegates representation resolution through the shared resolver", async () => {
    const representation = {
      didDocumentStream: new Uint8Array([123, 125]),
      didDocumentMetadata: { versionId: "1" },
      didResolutionMetadata: { contentType: "application/did+json" },
    };
    const options = { accept: "application/did+json" };
    midnightDidMocks.state.resolveRepresentation.mockResolvedValue(
      representation,
    );

    const result = await resolveRepresentation(
      {} as never,
      didContract as never,
      options,
    );

    expect(midnightDidMocks.state.resolveRepresentation).toHaveBeenCalledWith(
      `did:midnight:devnet:${"a".repeat(64)}`,
      options,
    );
    expect(result).toEqual(representation);
  });
});
