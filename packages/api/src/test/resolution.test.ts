import { LedgerToDomain } from "@midnight-ntwrk/midnight-did";
import { parseContractAddress } from "@midnight-ntwrk/midnight-did/midnight";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getMidnightNetwork } from "../did-subject.js";
import { getMidnightDIDLedgerState } from "../ledger-state.js";
import { resolveDIDResolutionResult } from "../resolution.js";

vi.mock("@midnight-ntwrk/midnight-did", () => ({
  LedgerToDomain: {
    ledgerStateToDIDDocument: vi.fn(),
    ledgerStateToMetadata: vi.fn(),
  },
}));

vi.mock("@midnight-ntwrk/midnight-did/midnight", () => ({
  parseContractAddress: vi.fn((value: string) => value),
}));

vi.mock("../did-subject.js", () => ({
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
  });

  it("returns a DID Core resolution envelope on success", async () => {
    const ledgerState = { version: 1n };
    const didDocument = {
      "@context": "https://www.w3.org/ns/did/v1",
      id: `did:midnight:devnet:${"a".repeat(64)}`,
    };
    const didDocumentMetadata = { versionId: "1" };

    vi.mocked(getMidnightDIDLedgerState).mockResolvedValue(ledgerState as never);
    vi.mocked(LedgerToDomain.ledgerStateToDIDDocument).mockReturnValue(
      didDocument as never,
    );
    vi.mocked(LedgerToDomain.ledgerStateToMetadata).mockReturnValue(
      didDocumentMetadata,
    );

    const result = await resolveDIDResolutionResult(
      {} as never,
      didContract as never,
    );

    expect(parseContractAddress).toHaveBeenCalledWith("a".repeat(64));
    expect(getMidnightNetwork).toHaveBeenCalled();
    expect(result).toEqual({
      didDocument,
      didDocumentMetadata,
      didResolutionMetadata: {},
    });
    expect(result.didResolutionMetadata.contentType).toBeUndefined();
  });

  it("returns notFound when the contract state is missing", async () => {
    vi.mocked(getMidnightDIDLedgerState).mockResolvedValue(null);

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
