import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import { DIDDocumentMetadata, PublicKeyJwk, Service } from "@midnight-ntwrk/midnight-did-domain";
import { MidnightNetwork, parseContractAddress } from "./midnight.js";
import { MidnightDIDDocument } from "./midnight-did-document.js";
type Ledger = DIDContract.Ledger;
type LedgerPublicKeyJwk = DIDContract.PublicKeyJwk;
type LedgerSchnorrJubjubVerificationMethod = DIDContract.SchnorrJubjubVerificationMethod;
type LedgerService = DIDContract.Service;
export declare class LedgerToDomain {
    private static readonly KeyTypeMap;
    private static readonly CurveTypeMap;
    private static readonly VerificationMethodTypeMap;
    private static readonly VerificationMethodRelationMap;
    static publicKeyJwk(publicKeyJwk: LedgerPublicKeyJwk): PublicKeyJwk;
    static schnorrJubjubPublicKeyJwk(verificationMethod: LedgerSchnorrJubjubVerificationMethod): PublicKeyJwk;
    private static ledgerOpaqueString;
    static service(service: LedgerService): Service;
    private static parseServiceType;
    private static parseServiceEndpoint;
    static verificationMethodId(id: string): string;
    static absoluteDidUrlReference(did: string, id: string): string;
    static toJSON(ledger: Ledger): object;
    static ledgerStateToDIDDocument(ledger: Ledger, network: MidnightNetwork, contractAddress: ReturnType<typeof parseContractAddress>): MidnightDIDDocument;
    static ledgerStateToMetadata(ledger: Ledger): DIDDocumentMetadata;
    private static timestampToIsoString;
}
export {};
//# sourceMappingURL=ledger-to-domain.d.ts.map