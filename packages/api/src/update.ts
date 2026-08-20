import "./polyfills.js";

export { MidnightDidApiError } from "./api-errors.js";
export { rotateControllerKey } from "./controller-operations.js";
export { getMidnightNetwork } from "./did-subject.js";
export {
  addAlsoKnownAs,
  deactivate,
  removeAlsoKnownAs,
} from "./document-operations.js";
export {
  discardPendingControllerPrivateState,
  type DiscardPendingControllerPrivateStateOptions,
  PendingControllerPrivateStateBusyError,
  type PendingControllerPrivateStateErrorCode,
  PendingControllerPrivateStateExistsError,
  PendingControllerPrivateStateUnavailableError,
  PrivateStateProviderContractMismatchError,
  type PrivateStateProviderContractMismatchErrorCode,
  recoverPendingControllerPrivateState,
  type RecoverPendingControllerPrivateStateOptions,
} from "./private-state.js";
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
  type VerificationMethodErrorCode,
  VerificationMethodReferencedError,
} from "./verification-method-errors.js";
export {
  addVerificationMethod,
  addVerificationMethodRelation,
  removeVerificationMethod,
  removeVerificationMethodRelation,
  updateVerificationMethod,
} from "./verification-method-operations.js";
