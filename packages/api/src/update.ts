import "./polyfills.js";

export { getMidnightNetwork } from "./did-subject.js";
export {
  addAlsoKnownAs,
  deactivate,
  removeAlsoKnownAs,
} from "./document-operations.js";
export { resolve } from "./resolution.js";
export {
  addService,
  removeService,
  updateService,
} from "./service-operations.js";
export {
  addVerificationMethod,
  addVerificationMethodRelation,
  removeVerificationMethod,
  removeVerificationMethodRelation,
  updateVerificationMethod,
} from "./verification-method-operations.js";
