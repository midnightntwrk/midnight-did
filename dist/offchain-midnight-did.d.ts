import { createOffchainMidnightDidDocumentMetadata, type OffchainMidnightDIDState, type ParsedLongFormOffchainMidnightDID } from "@midnight-ntwrk/midnight-did-domain";
import { type MidnightDIDDocument } from "./midnight-did-document.js";
export type ResolvedLongFormOffchainMidnightDID = {
    readonly did: string;
    readonly parsed: ParsedLongFormOffchainMidnightDID;
    readonly state: OffchainMidnightDIDState;
    readonly didDocument: MidnightDIDDocument;
    readonly didDocumentMetadata: ReturnType<typeof createOffchainMidnightDidDocumentMetadata>;
};
export declare const resolveLongFormOffchainMidnightDID: (input: string) => ResolvedLongFormOffchainMidnightDID;
export declare const assertOffchainMidnightDID: (did: string) => string;
//# sourceMappingURL=offchain-midnight-did.d.ts.map