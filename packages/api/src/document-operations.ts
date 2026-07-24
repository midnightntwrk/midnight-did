import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import { assertAbsoluteUri } from "@midnight-ntwrk/midnight-did-domain";
import { type FinalizedTxData } from "@midnight-ntwrk/midnight-js-types";

import { createControllerAuthorization } from "./controller-authorization.js";
import {
  type DeployedMidnightDIDContract,
  type MidnightDIDProviders,
} from "./types.js";

export const addAlsoKnownAs = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  aliasUri: string,
): Promise<FinalizedTxData> => {
  const alias = assertAbsoluteUri(aliasUri, "aliasUri");
  const [signature, expectedVersion] = await createControllerAuthorization(
    didContract,
    providers,
  );
  const result = await didContract.callTx.setAlsoKnownAs(
    alias,
    DIDContract.SetMutation.Insert,
    signature,
    expectedVersion,
  );
  return result.public;
};

export const removeAlsoKnownAs = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
  aliasUri: string,
): Promise<FinalizedTxData> => {
  const alias = assertAbsoluteUri(aliasUri, "aliasUri");
  const [signature, expectedVersion] = await createControllerAuthorization(
    didContract,
    providers,
  );
  const result = await didContract.callTx.setAlsoKnownAs(
    alias,
    DIDContract.SetMutation.Remove,
    signature,
    expectedVersion,
  );
  return result.public;
};

export const deactivate = async (
  didContract: DeployedMidnightDIDContract,
  providers: MidnightDIDProviders,
): Promise<FinalizedTxData> => {
  const [signature, expectedVersion] = await createControllerAuthorization(
    didContract,
    providers,
  );
  const result = await didContract.callTx.deactivate(
    signature,
    expectedVersion,
  );
  return result.public;
};
