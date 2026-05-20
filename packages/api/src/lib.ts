export { setLogger } from "./api-logger.js";
export {
  createDID,
  deploy,
  getMidnightDIDLedgerState,
  initPrivateState,
  joinContract,
  midnightDIDContractInstance,
} from "./contract-lifecycle.js";
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
} from "./did-operations.js";
export {
  buildFreshWallet,
  buildWallet,
  buildWalletAndWaitForFunds,
  configureProviders,
  createWalletAndMidnightProvider,
  deriveUnshieldedAddressFromSeed,
  getWalletBalances,
  registerForDustGeneration,
  restoreWalletFromState,
  serializeWalletState,
  waitForWalletFunds,
  waitForWalletSync,
} from "./wallet.js";
