/* c8 ignore file */
import { DIDDocument, DIDString } from "./did-document.js";

export interface MidnightDIDResolver {
  resolve(did: DIDString): Promise<DIDDocument>;
}
