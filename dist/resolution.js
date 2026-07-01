import { LedgerToDomain, } from "@midnight-ntwrk/midnight-did";
import { parseContractAddress } from "@midnight-ntwrk/midnight-did/midnight";
import { getLogger } from "./api-logger.js";
import { getMidnightNetwork } from "./did-subject.js";
import { getMidnightDIDLedgerState } from "./ledger-state.js";
import { BigIntReplacer } from "./logger-utils.js";
export const resolve = async (providers, didContract) => {
    const network = getMidnightNetwork();
    const contractAddress = didContract.deployTxData.public.contractAddress;
    const midnightContractAddress = parseContractAddress(contractAddress);
    const didContractState = await getMidnightDIDLedgerState(providers, midnightContractAddress);
    if (didContractState === null) {
        getLogger().info(`There is no Midnight DID contract deployed at ${contractAddress}.`);
        return null;
    }
    const didDocument = LedgerToDomain.ledgerStateToDIDDocument(didContractState, network, midnightContractAddress);
    const didDocumentMetadata = LedgerToDomain.ledgerStateToMetadata(didContractState);
    getLogger().info(`MidnightDID Resolution Result:\n      ${JSON.stringify({ didDocument, didDocumentMetadata }, BigIntReplacer, 2)}`);
    return { didDocument, didDocumentMetadata };
};
//# sourceMappingURL=resolution.js.map