import {
  DIDContract,
  signControllerAuthorization,
} from "@midnight-ntwrk/midnight-did-contract";

import { requireDeployedMidnightDIDLedgerState } from "./ledger-state.js";
import { requirePrivateState } from "./private-state.js";
import {
  type DeployedMidnightDIDContract,
  type MidnightDIDProviders,
  type SchnorrJubjubDigest,
  type SchnorrJubjubSignature,
} from "./types.js";

export type ControllerAuthorization = readonly [
  signature: SchnorrJubjubSignature,
  expectedVersion: bigint,
];

export type ControllerAuthorizationDigestFactory = (
  ledgerState: DIDContract.Ledger,
) => SchnorrJubjubDigest;

export const asSchnorrJubjubDigest = (
  value: readonly bigint[],
): SchnorrJubjubDigest => {
  if (value.length !== 4) {
    throw new Error(
      "Controller authorization digest must have exactly 4 fields",
    );
  }
  return [value[0], value[1], value[2], value[3]];
};

export const createControllerAuthorization = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  digestFactory: ControllerAuthorizationDigestFactory,
  knownLedgerState?: DIDContract.Ledger,
  knownPrivateState?: { readonly secretKey: Uint8Array },
): Promise<ControllerAuthorization> => {
  const [privateState, ledgerState] = await Promise.all([
    knownPrivateState ?? requirePrivateState(providers),
    knownLedgerState ??
      requireDeployedMidnightDIDLedgerState(providers, didContract),
  ]);
  return [
    signControllerAuthorization(
      privateState.secretKey,
      digestFactory(ledgerState),
    ),
    ledgerState.version,
  ];
};
