import { DIDDocument } from "./did-document";
import { DIDOperation } from "./did-operations";

/**
 * A generic DIDRegistrar interface following the W3C DID Core specification.
 * Supports create, update, and deactivate operations on DIDs.
 *
 * @template D - The DID type (e.g., DID, MidnightDID)
 */
export interface DIDRegistrar<D> {
  /**
   * Create a new DID on the corresponding method ledger or network.
   * @param controller - the controller of the DID
   * @returns the created DID and its initial DIDDocument
   */
  create(
    patches?: Array<DIDOperation>
  ): Promise<{ did: D; document: DIDDocument }>;

  /**
   * Update an existing DID document on the corresponding ledger or method.
   * @param did - the DID to update
   * @param patches - JSON Patch or method-specific update instructions
   * @returns the updated DIDDocument
   */
  update(did: D, patches: Array<DIDOperation>): Promise<DIDDocument>;

  /**
   * Deactivate a DID, marking it as no longer valid on the ledger or method.
   * @param did - the DID to deactivate
   * @returns confirmation of deactivation
   */
  deactivate(did: D): Promise<DIDDocument>;
}
