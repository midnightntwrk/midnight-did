import { DIDDocument, DIDString } from "./did-document";

/**
 * Domain interface for resolving a MidnightDID to a DIDDocument.
 */
export interface MidnightDIDResolver {
  /**
   * Resolves the provided MidnightDID into its DIDDocument.
   * @param did - the MidnightDID to resolve
   * @returns the resolved DIDDocument
   */
  resolve(did: DIDString): Promise<DIDDocument>;
}
