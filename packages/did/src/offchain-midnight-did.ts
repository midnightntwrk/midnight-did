import {
  createOffchainMidnightDidDocumentMetadata,
  decodeOffchainMidnightDIDState,
  MidnightNetwork,
  type OffchainMidnightDIDState,
  offchainStateToDidDocument,
  type ParsedPortableOffchainMidnightDIDUrl,
  parseMidnightDID,
  parseMidnightDIDString,
  parsePortableOffchainMidnightDIDUrl,
} from "@midnight-ntwrk/midnight-did-domain";

import {
  type MidnightDIDDocument,
  parseMidnightDIDDocument,
} from "./midnight-did-document.js";

export type ResolvedPortableOffchainMidnightDID = {
  readonly did: string;
  readonly parsed: ParsedPortableOffchainMidnightDIDUrl;
  readonly state: OffchainMidnightDIDState;
  readonly didDocument: MidnightDIDDocument;
  readonly didDocumentMetadata: ReturnType<
    typeof createOffchainMidnightDidDocumentMetadata
  >;
};

export const resolvePortableOffchainMidnightDID = (
  input: string,
): ResolvedPortableOffchainMidnightDID => {
  const parsed = parsePortableOffchainMidnightDIDUrl(input);
  const state = decodeOffchainMidnightDIDState(parsed.encodedState);
  const didDocument = parseMidnightDIDDocument(
    offchainStateToDidDocument(parsed.did, state),
  );
  return {
    did: parsed.did,
    parsed,
    state,
    didDocument,
    didDocumentMetadata: createOffchainMidnightDidDocumentMetadata(state),
  };
};

export const assertOffchainMidnightDID = (did: string): string => {
  const parsed = parseMidnightDID(parseMidnightDIDString(did));
  if (parsed.network !== MidnightNetwork.Offchain) {
    throw new Error("Expected an offchain Midnight DID");
  }
  return did;
};
