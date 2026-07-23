import {
  MidnightDIDDocument,
  MidnightDIDResolver,
} from "@midnight-ntwrk/midnight-did";
import { parseContractAddress } from "@midnight-ntwrk/midnight-did/midnight";
import {
  type DIDDocumentMetadata,
  type DIDResolutionErrorCode,
} from "@midnight-ntwrk/midnight-did-domain";

import { getLogger } from "./api-logger.js";
import { getDidSubject, getMidnightNetwork } from "./did-subject.js";
import { getMidnightDIDLedgerState } from "./ledger-state.js";
import { BigIntReplacer } from "./logger-utils.js";
import {
  type DeployedMidnightDIDContract,
  type MidnightDIDProviders,
} from "./types.js";

export const resolve = async (
  providers: MidnightDIDProviders,
  didContract: DeployedMidnightDIDContract,
): Promise<{
  didDocument: MidnightDIDDocument;
  didDocumentMetadata: DIDDocumentMetadata;
} | null> => {
  const contractAddress = didContract.deployTxData.public.contractAddress;
  const resolver = new MidnightDIDResolver({
    expectedNetwork: getMidnightNetwork(),
    ledgerReader: async (ledgerContractAddress) =>
      await getMidnightDIDLedgerState(
        providers,
        parseContractAddress(ledgerContractAddress),
      ),
  });
  const result = await resolver.resolveResult(getDidSubject(didContract));
  if (result === null) {
    getLogger().info(
      `There is no Midnight DID contract deployed at ${contractAddress}.`,
    );
    return null;
  }
  getLogger().info(
    `MidnightDID Resolution Result:\n      ${JSON.stringify(
      result,
      BigIntReplacer,
      2,
    )}`,
  );
  return result;
};

export type MidnightDIDResolutionResult = {
  didDocument: MidnightDIDDocument | null;
  didDocumentMetadata: DIDDocumentMetadata;
  didResolutionMetadata: {
    error?: DIDResolutionErrorCode;
  };
};

export const resolveDIDResolutionResult = async (
  providers: MidnightDIDProviders,
  didContract: DeployedMidnightDIDContract,
): Promise<MidnightDIDResolutionResult> => {
  try {
    const result = await resolve(providers, didContract);
    if (result === null) {
      return {
        didDocument: null,
        didDocumentMetadata: {},
        didResolutionMetadata: { error: "notFound" },
      };
    }
    return {
      didDocument: result.didDocument,
      didDocumentMetadata: result.didDocumentMetadata,
      didResolutionMetadata: {},
    };
  } catch (error) {
    getLogger().error(
      `MidnightDID resolution failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return {
      didDocument: null,
      didDocumentMetadata: {},
      didResolutionMetadata: { error: "internalError" },
    };
  }
};
