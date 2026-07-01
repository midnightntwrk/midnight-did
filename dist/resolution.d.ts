import { MidnightDIDDocument } from "@midnight-ntwrk/midnight-did";
import { DIDDocumentMetadata } from "@midnight-ntwrk/midnight-did-domain";
import { type DeployedMidnightDIDContract, type MidnightDIDProviders } from "./types.js";
export declare const resolve: (providers: MidnightDIDProviders, didContract: DeployedMidnightDIDContract) => Promise<{
    didDocument: MidnightDIDDocument;
    didDocumentMetadata: DIDDocumentMetadata;
} | null>;
