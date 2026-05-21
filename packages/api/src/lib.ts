import "./polyfills.js";

export { setLogger } from "./api-logger.js";
export {
  createDID,
  deploy,
  getMidnightDIDLedgerState,
  initPrivateState,
  joinContract,
  midnightDIDContractInstance,
} from "./deploy.js";
export {
  configureProviders,
  createWalletAndMidnightProvider,
} from "./providers.js";
export {
  addAlsoKnownAs,
  addService,
  addVerificationMethod,
  addVerificationMethodRelation,
  deactivate,
  getMidnightNetwork,
  removeAlsoKnownAs,
  removeService,
  removeVerificationMethod,
  removeVerificationMethodRelation,
  resolve,
  updateService,
  updateVerificationMethod,
} from "./update.js";
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
