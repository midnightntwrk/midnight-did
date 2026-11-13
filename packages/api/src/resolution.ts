import {
  MidnightDIDDocument,
  type MidnightDIDRepresentationResult as ResolverDIDRepresentationResult,
  type MidnightDIDResolutionOptions as ResolverDIDResolutionOptions,
  type MidnightDIDResolutionResult as ResolverDIDResolutionResult,
  MidnightDIDResolver,
} from "@midnight-ntwrk/midnight-did";
import {
  type MidnightNetwork,
  parseContractAddress,
} from "@midnight-ntwrk/midnight-did/midnight";
import { type DIDDocumentMetadata } from "@midnight-ntwrk/midnight-did-domain";

import { getLogger } from "./api-logger.js";
import { getDidSubject, getProviderMidnightNetwork } from "./did-subject.js";
import { getMidnightDIDLedgerState } from "./ledger-state.js";
import { BigIntReplacer } from "./logger-utils.js";
import {
  type DeployedMidnightDIDContract,
  type MidnightDIDProviders,
} from "./types.js";

const createResolver = (
  providers: MidnightDIDProviders,
  network: MidnightNetwork,
): MidnightDIDResolver =>
  new MidnightDIDResolver({
    expectedNetwork: network,
    ledgerReader: async (ledgerContractAddress) =>
      await getMidnightDIDLedgerState(
        providers,
        parseContractAddress(ledgerContractAddress),
      ),
  });

export const resolve = async (
  providers: MidnightDIDProviders,
  didContract: DeployedMidnightDIDContract,
): Promise<{
  didDocument: MidnightDIDDocument;
  didDocumentMetadata: DIDDocumentMetadata;
} | null> => {
  const network = getProviderMidnightNetwork(providers);
  const contractAddress = didContract.deployTxData.public.contractAddress;
  const resolver = createResolver(providers, network);
  const result = await resolver.resolveResult(
    getDidSubject(didContract, network),
  );
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

export type MidnightDIDResolutionResult = ResolverDIDResolutionResult;

export const resolveDIDResolutionResult = async (
  providers: MidnightDIDProviders,
  didContract: DeployedMidnightDIDContract,
): Promise<MidnightDIDResolutionResult> => {
  const network = getProviderMidnightNetwork(providers);
  const resolver = createResolver(providers, network);
  return await resolver.resolveDIDResolutionResult(
    getDidSubject(didContract, network),
  );
};

export type MidnightDIDRepresentationResult = ResolverDIDRepresentationResult;
export type MidnightDIDResolutionOptions = ResolverDIDResolutionOptions;

export const resolveRepresentation = async (
  providers: MidnightDIDProviders,
  didContract: DeployedMidnightDIDContract,
  options?: MidnightDIDResolutionOptions,
): Promise<MidnightDIDRepresentationResult> => {
  const network = getProviderMidnightNetwork(providers);
  const resolver = createResolver(providers, network);
  return await resolver.resolveRepresentation(
    getDidSubject(didContract, network),
    options,
  );
};
