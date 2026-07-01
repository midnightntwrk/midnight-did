import { createMidnightDIDString, parseContractAddress, } from "@midnight-ntwrk/midnight-did/midnight";
import { normalizeBoundFragmentId as normalizeBoundFragmentIdWithSubject, } from "@midnight-ntwrk/midnight-did-domain";
import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { RuntimeToDomain } from "./runtime-to-domain.js";
export const getMidnightNetwork = () => RuntimeToDomain.NetworkMap[getNetworkId()];
export const getDidSubject = (didContract) => {
    const contractAddress = parseContractAddress(didContract.deployTxData.public.contractAddress);
    return createMidnightDIDString(contractAddress, getMidnightNetwork());
};
export const normalizeBoundFragmentId = (didContract, value, field) => normalizeBoundFragmentIdWithSubject(value, field, getDidSubject(didContract));
//# sourceMappingURL=did-subject.js.map