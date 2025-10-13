/* c8 ignore file */
import { DIDDocument, DIDString } from "./did-document";

export interface MidnightDIDResolver {
  resolve(did: DIDString): Promise<DIDDocument>;
}
