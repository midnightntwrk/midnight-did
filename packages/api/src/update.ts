import "./polyfills.js";

export { rotateControllerKey } from "./controller-operations.js";
export { getMidnightNetwork } from "./did-subject.js";
export {
  addAlsoKnownAs,
  deactivate,
  removeAlsoKnownAs,
} from "./document-operations.js";
export {
  resolve,
  resolveDIDResolutionResult,
  resolveRepresentation,
} from "./resolution.js";
export {
  addService,
  removeService,
  updateService,
} from "./service-operations.js";
export {
  type ReferencedVerificationMethodRelation,
  VerificationMethodReferencedError,
} from "./verification-method-errors.js";
export {
  addVerificationMethod,
  addVerificationMethodRelation,
  removeVerificationMethod,
  removeVerificationMethodRelation,
  updateVerificationMethod,
} from "./verification-method-operations.js";
