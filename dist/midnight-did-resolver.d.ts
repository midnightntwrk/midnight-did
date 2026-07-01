import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import { type DIDDocumentMetadata } from "@midnight-ntwrk/midnight-did-domain";
import { MidnightNetwork } from "./midnight.js";
import { type MidnightDIDDocument } from "./midnight-did-document.js";
export type MidnightLedgerState = DIDContract.Ledger;
export type MidnightLedgerReader = (contractAddress: string) => Promise<MidnightLedgerState | null>;
export type MidnightDIDResolverOptions = {
    ledgerReader: MidnightLedgerReader;
    expectedNetwork?: MidnightNetwork;
};
export type MidnightResolutionResult = {
    didDocument: MidnightDIDDocument;
    didDocumentMetadata: DIDDocumentMetadata;
};
export declare class MidnightDIDResolver {
    private readonly ledgerReader;
    private readonly expectedNetwork;
    constructor(options: MidnightDIDResolverOptions);
    resolve(did: string): Promise<MidnightDIDDocument>;
    resolveResult(did: string): Promise<MidnightResolutionResult | null>;
}
//# sourceMappingURL=midnight-did-resolver.d.ts.map