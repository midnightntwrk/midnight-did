import "./polyfills.js";

export { midnightDIDContractInstance } from "./contract-instance.js";
export {
  createDID,
  deploy,
  joinContract,
} from "./contract-lifecycle-operations.js";
export {
  getMidnightDIDLedgerState,
  requireDeployedMidnightDIDLedgerState,
  requireMidnightDIDLedgerState,
} from "./ledger-state.js";
export {
  initPrivateState,
  isRestorableDIDPrivateState,
} from "./private-state.js";
