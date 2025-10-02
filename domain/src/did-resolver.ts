import { DIDDocument, DIDString } from "./did-document";

export interface MidnightDIDResolver {
  resolve(did: DIDString): Promise<DIDDocument>;
}

