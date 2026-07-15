import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import {
  type ContractAddress,
  type DIDDocumentMetadata,
  type DIDResolutionErrorCode,
  parseMidnightDID,
  parseMidnightDIDString,
} from "@midnight-ntwrk/midnight-did-domain";

import { LedgerToDomain } from "./ledger-to-domain.js";
import { MidnightNetwork } from "./midnight.js";
import { type MidnightDIDDocument } from "./midnight-did-document.js";

export type MidnightLedgerState = DIDContract.Ledger;

export type MidnightLedgerReader = (
  contractAddress: string,
) => Promise<MidnightLedgerState | null>;

export type MidnightDIDResolverOptions = {
  ledgerReader: MidnightLedgerReader;
  expectedNetwork?: MidnightNetwork;
};

export type MidnightResolutionResult = {
  didDocument: MidnightDIDDocument;
  didDocumentMetadata: DIDDocumentMetadata;
};

export type MidnightDIDResolutionResult = {
  didDocument: MidnightDIDDocument | null;
  didDocumentMetadata: DIDDocumentMetadata;
  didResolutionMetadata: {
    error?: DIDResolutionErrorCode;
  };
};

const resolutionEnvelope = (
  result: MidnightResolutionResult | null,
  error?: DIDResolutionErrorCode,
): MidnightDIDResolutionResult => ({
  didDocument: result?.didDocument ?? null,
  didDocumentMetadata: result?.didDocumentMetadata ?? {},
  didResolutionMetadata: error === undefined ? {} : { error },
});

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const resolutionErrorCode = (error: unknown): DIDResolutionErrorCode => {
  const message = errorMessage(error);
  if (
    message.includes("Invalid DID") ||
    message.includes("Invalid method-specific identifier") ||
    message.includes("id must be a valid Midnight DID")
  ) {
    return "invalidDid";
  }
  if (
    message.includes("Offchain Midnight DIDs") ||
    message.includes("Network mismatch")
  ) {
    return "methodNotSupported";
  }
  return "internalError";
};

export class MidnightDIDResolver {
  private readonly ledgerReader: MidnightLedgerReader;
  private readonly expectedNetwork: MidnightNetwork | null;

  constructor(options: MidnightDIDResolverOptions) {
    this.ledgerReader = options.ledgerReader;
    this.expectedNetwork = options.expectedNetwork ?? null;
  }

  async resolve(did: string): Promise<MidnightDIDDocument> {
    const result = await this.resolveResult(did);
    if (result === null) {
      throw new Error(`DID not found: ${did}`);
    }
    return result.didDocument;
  }

  async resolveResult(did: string): Promise<MidnightResolutionResult | null> {
    const parsed = parseMidnightDIDString(did);
    const { network, id } = parseMidnightDID(parsed);

    if (network === MidnightNetwork.Offchain) {
      throw new Error(
        "Offchain Midnight DIDs must be resolved from their long-form encoded state, not through the ledger resolver",
      );
    }

    if (this.expectedNetwork !== null && network !== this.expectedNetwork) {
      throw new Error(
        `Network mismatch: DID network is ${network}, expected ${this.expectedNetwork}`,
      );
    }

    const contractAddress = id as ContractAddress;
    const ledgerState = await this.ledgerReader(contractAddress);
    if (ledgerState === null) return null;

    return {
      didDocument: LedgerToDomain.ledgerStateToDIDDocument(
        ledgerState,
        network,
        contractAddress,
      ),
      didDocumentMetadata: LedgerToDomain.ledgerStateToMetadata(ledgerState),
    };
  }

  async resolveDIDResolutionResult(
    did: string,
  ): Promise<MidnightDIDResolutionResult> {
    try {
      const result = await this.resolveResult(did);
      return resolutionEnvelope(
        result,
        result === null ? "notFound" : undefined,
      );
    } catch (error) {
      return resolutionEnvelope(null, resolutionErrorCode(error));
    }
  }
}
