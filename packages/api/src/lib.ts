import "./polyfills.js";

export { setLogger } from "./api-logger.js";
export { midnightDIDContractInstance } from "./contract-instance.js";
export {
  createDID,
  deploy,
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
  initPrivateState,
  recoverPendingControllerPrivateState,
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
