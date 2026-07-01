import { DIDDocument, DIDString } from "./did-document.js";
export interface MidnightDIDResolver {
    resolve(did: DIDString): Promise<DIDDocument>;
}
//# sourceMappingURL=did-resolver.d.ts.map