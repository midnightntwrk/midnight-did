import {
  MidnightDIDResolver,
  type MidnightDIDString,
  MidnightNetwork,
  parseContractAddress,
  parseMidnightDID,
  parseMidnightDIDString,
} from '@midnight-ntwrk/midnight-did';
import * as api from '@midnight-ntwrk/midnight-did-api';
import type { PublicJwk } from '@midnight-ntwrk/midnight-did-secret-storage';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';

import type { SetupProfile } from '../config.js';

export type ResolvedDidVerificationMethod = {
  did: MidnightDIDString;
  verificationMethodId: string;
  publicJwk: PublicJwk;
};

const setupProfileToNetwork = (profile: SetupProfile): MidnightNetwork => {
  if (profile === 'preprod') return MidnightNetwork.Preprod;
  if (profile === 'mainnet') return MidnightNetwork.Mainnet;
  return MidnightNetwork.Undeployed;
};

const parseAbsoluteVerificationMethodId = (
  value: string,
): { did: MidnightDIDString; verificationMethodId: string; fragment: string } => {
  const hashIndex = value.indexOf('#');
  if (hashIndex <= 0 || hashIndex === value.length - 1) {
    throw new Error(
      'Verification method id must be an absolute Midnight DID URL with a fragment.',
    );
  }
  const did = parseMidnightDIDString(value.slice(0, hashIndex));
  return {
    did,
    verificationMethodId: value,
    fragment: value.slice(hashIndex),
  };
};

export const createDidVerificationMethodResolver = (input: {
  setupProfile: SetupProfile;
  indexerUrl: string;
  indexerWsUrl: string;
}) => {
  const expectedNetwork = setupProfileToNetwork(input.setupProfile);
  const publicDataProvider = indexerPublicDataProvider(
    input.indexerUrl,
    input.indexerWsUrl,
  );
  const resolver = new MidnightDIDResolver({
    expectedNetwork,
    ledgerReader: async (contractAddress) => {
      return await api.getMidnightDIDLedgerState(
        { publicDataProvider } as api.MidnightDIDProviders,
        parseContractAddress(contractAddress),
      );
    },
  });

  return async (
    verificationMethodId: string,
  ): Promise<ResolvedDidVerificationMethod> => {
    const parsed = parseAbsoluteVerificationMethodId(verificationMethodId);
    const didDocument = await resolver.resolve(parsed.did);
    const method =
      didDocument.verificationMethod?.find(
        (entry) =>
          entry.id === parsed.verificationMethodId ||
          entry.id === parsed.fragment,
      ) ?? null;

    if (method === null) {
      throw new Error(
        `Verification method ${verificationMethodId} was not found in ${parsed.did}.`,
      );
    }

    const { network } = parseMidnightDID(parsed.did);
    if (network !== expectedNetwork) {
      throw new Error(
        `Verification method network ${network} does not match active setup ${expectedNetwork}.`,
      );
    }

    return {
      did: parsed.did,
      verificationMethodId: parsed.verificationMethodId,
      publicJwk: method.publicKeyJwk as PublicJwk,
    };
  };
};
