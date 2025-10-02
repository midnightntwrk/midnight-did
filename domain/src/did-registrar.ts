import { DIDDocument } from "./did-document";
import { DIDOperation } from "./did-operations";

export interface DIDRegistrar<D> {
  create(
    patches?: Array<DIDOperation>
  ): Promise<{ did: D; document: DIDDocument }>;

  update(did: D, patches: Array<DIDOperation>): Promise<DIDDocument>;

  deactivate(did: D): Promise<DIDDocument>;
}

