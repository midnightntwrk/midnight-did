import "./polyfills.js";

export { MidnightDidApiError } from "./api-errors.js";
export { setLogger } from "./api-logger.js";
export { midnightDIDContractInstance } from "./contract-instance.js";
export {
  createDID,
  deploy,
  DIDContractDeploymentFinalizedPrivateStateIncompleteError,
  type DIDContractDeploymentFinalizedPrivateStateIncompleteErrorCode,
  type DIDContractDeploymentSetupStage,
  joinContract,
} from "./contract-lifecycle-operations.js";
export {
  recoverControllerKey,
  rotateControllerKey,
} from "./controller-operations.js";
export { getMidnightNetwork } from "./did-subject.js";
export {
  addAlsoKnownAs,
  deactivate,
  removeAlsoKnownAs,
} from "./document-operations.js";
export { getMidnightDIDLedgerState } from "./ledger-state.js";
export {
  discardPendingControllerPrivateState,
  type DiscardPendingControllerPrivateStateOptions,
  initPrivateState,
  PendingControllerPrivateStateBusyError,
  type PendingControllerPrivateStateErrorCode,
  PendingControllerPrivateStateExistsError,
  PendingControllerPrivateStateUnavailableError,
  PrivateStateProviderContractMismatchError,
  type PrivateStateProviderContractMismatchErrorCode,
  recoverPendingControllerPrivateState,
  type RecoverPendingControllerPrivateStateOptions,
  requirePrivateState,
  restorePrivateState,
} from "./private-state.js";
export {
  configureProviders,
  createWalletAndMidnightProvider,
} from "./providers.js";
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
  addSchnorrJubjubVerificationMethod,
  addVerificationMethod,
  addVerificationMethodRelation,
  removeSchnorrJubjubVerificationMethod,
  removeVerificationMethod,
  removeVerificationMethodRelation,
  updateSchnorrJubjubVerificationMethod,
  updateVerificationMethod,
  verifySchnorrJubjubDigestSignature,
} from "./verification-method-operations.js";
export {
  buildFreshWallet,
  buildWallet,
  buildWalletAndWaitForFunds,
  getWalletBalances,
  registerForDustGeneration,
  restoreWalletFromState,
  serializeWalletState,
  waitForWalletFunds,
  waitForWalletSync,
} from "./wallet.js";
export { deriveUnshieldedAddressFromSeed } from "./wallet-keys.js";
