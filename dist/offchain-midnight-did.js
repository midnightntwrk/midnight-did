import { createOffchainMidnightDidDocumentMetadata, decodeOffchainMidnightDIDState, MidnightNetwork, offchainStateToDidDocument, parseLongFormOffchainMidnightDIDString, parseMidnightDID, parseMidnightDIDString, } from "@midnight-ntwrk/midnight-did-domain";
import { parseMidnightDIDDocument, } from "./midnight-did-document.js";
export const resolveLongFormOffchainMidnightDID = (input) => {
    const parsed = parseLongFormOffchainMidnightDIDString(input);
    const state = decodeOffchainMidnightDIDState(parsed.encodedState);
    const didDocument = parseMidnightDIDDocument(offchainStateToDidDocument(parsed.did, state));
    return {
        did: parsed.did,
        parsed,
        state,
        didDocument,
        didDocumentMetadata: createOffchainMidnightDidDocumentMetadata(state),
    };
};
export const assertOffchainMidnightDID = (did) => {
    const parsed = parseMidnightDID(parseMidnightDIDString(did));
    if (parsed.network !== MidnightNetwork.Offchain) {
        throw new Error("Expected an offchain Midnight DID");
    }
    return did;
};
//# sourceMappingURL=offchain-midnight-did.js.map