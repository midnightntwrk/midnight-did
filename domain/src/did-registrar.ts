import { DIDDocument } from "./did-document";

export interface DIDRegistrar<D, Op = unknown> {
  create(patches?: Array<Op>): Promise<{ did: D; document: DIDDocument }>;
  update(did: D, patches: Array<Op>): Promise<DIDDocument>;
  deactivate(did: D): Promise<DIDDocument>;
}
