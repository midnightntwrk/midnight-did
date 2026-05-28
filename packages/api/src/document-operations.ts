import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import { assertAbsoluteUri } from "@midnight-ntwrk/midnight-did-domain";
import { type FinalizedTxData } from "@midnight-ntwrk/midnight-js-types";

import { type DeployedMidnightDIDContract } from "./types.js";

export const addAlsoKnownAs = async (
  didContract: DeployedMidnightDIDContract,
  aliasUri: string,
): Promise<FinalizedTxData> => {
  const alias = assertAbsoluteUri(aliasUri, "aliasUri");
  const result = await didContract.callTx.setAlsoKnownAs(
    alias,
    DIDContract.SetMutation.Insert,
  );
  return result.public;
};

export const removeAlsoKnownAs = async (
  didContract: DeployedMidnightDIDContract,
  aliasUri: string,
): Promise<FinalizedTxData> => {
  const alias = assertAbsoluteUri(aliasUri, "aliasUri");
  const result = await didContract.callTx.setAlsoKnownAs(
    alias,
    DIDContract.SetMutation.Remove,
  );
  return result.public;
};

export const deactivate = async (
  didContract: DeployedMidnightDIDContract,
): Promise<FinalizedTxData> => {
  const result = await didContract.callTx.deactivate();
  return result.public;
};
