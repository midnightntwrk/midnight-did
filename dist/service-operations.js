import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import { normalizeBoundFragmentId } from "./did-subject.js";
import { serviceToLedger } from "./ledger-mappers.js";
export const addService = async (didContract, service) => {
    const result = await didContract.callTx.setService(serviceToLedger(didContract, service), DIDContract.MapMutation.Insert);
    return result.public;
};
export const updateService = async (didContract, service) => {
    const result = await didContract.callTx.setService(serviceToLedger(didContract, service), DIDContract.MapMutation.Update);
    return result.public;
};
export const removeService = async (didContract, serviceId) => {
    const normalizedServiceId = normalizeBoundFragmentId(didContract, serviceId, "serviceId");
    const result = await didContract.callTx.removeService(normalizedServiceId);
    return result.public;
};
//# sourceMappingURL=service-operations.js.map