import { LedgerToDomain } from "@midnight-ntwrk/midnight-did";
import { parseContractAddress, } from "@midnight-ntwrk/midnight-did/midnight";
import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import { assertIsContractAddress } from "@midnight-ntwrk/midnight-js-utils";
import { getLogger } from "./api-logger.js";
export const getMidnightDIDLedgerState = async (providers, contractAddress) => {
    assertIsContractAddress(contractAddress);
    getLogger().info("Checking MidnightDID contract ledger state...");
    const state = await providers.publicDataProvider
        .queryContractState(contractAddress)
        .then((contractState) => contractState != null ? DIDContract.ledger(contractState.data) : null);
    if (state != null)
        getLogger().info(LedgerToDomain.toJSON(state));
    return state;
};
export const requireMidnightDIDLedgerState = async (providers, contractAddress) => {
    const didState = await getMidnightDIDLedgerState(providers, contractAddress);
    if (!didState) {
        throw new Error("Cannot query DID state");
    }
    return didState;
};
export const requireDeployedMidnightDIDLedgerState = async (providers, didContract) => await requireMidnightDIDLedgerState(providers, parseContractAddress(didContract.deployTxData.public.contractAddress));
//# sourceMappingURL=ledger-state.js.map