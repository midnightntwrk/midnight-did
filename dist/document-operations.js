import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import { assertAbsoluteUri } from "@midnight-ntwrk/midnight-did-domain";
export const addAlsoKnownAs = async (didContract, aliasUri) => {
    const alias = assertAbsoluteUri(aliasUri, "aliasUri");
    const result = await didContract.callTx.setAlsoKnownAs(alias, DIDContract.SetMutation.Insert);
    return result.public;
};
export const removeAlsoKnownAs = async (didContract, aliasUri) => {
    const alias = assertAbsoluteUri(aliasUri, "aliasUri");
    const result = await didContract.callTx.setAlsoKnownAs(alias, DIDContract.SetMutation.Remove);
    return result.public;
};
export const deactivate = async (didContract) => {
    const result = await didContract.callTx.deactivate();
    return result.public;
};
//# sourceMappingURL=document-operations.js.map