import { signControllerAuthorization } from "@midnight-ntwrk/midnight-did-contract";

import { requireDeployedMidnightDIDLedgerState } from "./ledger-state.js";
import { requirePrivateState } from "./private-state.js";
import {
  type DeployedMidnightDIDContract,
  type MidnightDIDProviders,
  type SchnorrJubjubSignature,
} from "./types.js";

export type ControllerAuthorization = readonly [
  signature: SchnorrJubjubSignature,
  expectedVersion: bigint,
];

export const createControllerAuthorization = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
): Promise<ControllerAuthorization> => {
  const [privateState, ledgerState] = await Promise.all([
    requirePrivateState(providers),
    requireDeployedMidnightDIDLedgerState(providers, didContract),
  ]);
  return [
    signControllerAuthorization(
      privateState.secretKey,
      ledgerState.id,
      ledgerState.version,
    ),
    ledgerState.version,
  ];
};
