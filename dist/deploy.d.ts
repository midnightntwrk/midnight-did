import "./polyfills.js";
export { midnightDIDContractInstance } from "./contract-instance.js";
export { createDID, deploy, joinContract, } from "./contract-lifecycle-operations.js";
export { rotateControllerKey } from "./controller-operations.js";
export { getMidnightDIDLedgerState, requireDeployedMidnightDIDLedgerState, requireMidnightDIDLedgerState, } from "./ledger-state.js";
export { initPrivateState, recoverPendingControllerPrivateState, requirePrivateState, restorePrivateState, } from "./private-state.js";
