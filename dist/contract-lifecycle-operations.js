import { deployContract, findDeployedContract, } from "@midnight-ntwrk/midnight-js-contracts";
import { getLogger } from "./api-logger.js";
import { midnightDIDCompiledContract } from "./contract-instance.js";
import { bindPrivateStateProvider, requirePrivateState, savePrivateState, } from "./private-state.js";
import { MidnightDIDPrivateStateId, } from "./types.js";
export const joinContract = async (providers, contractAddress) => {
    // Private state is scoped by contract address; bind before reading so join
    // cannot create or load controller state from the wrong DID namespace.
    bindPrivateStateProvider(providers, contractAddress);
    const initialPrivateState = await requirePrivateState(providers);
    const didContract = await findDeployedContract(providers, {
        contractAddress,
        compiledContract: midnightDIDCompiledContract,
        privateStateId: MidnightDIDPrivateStateId,
        initialPrivateState: initialPrivateState,
    });
    getLogger().info(`Joined contract at address: ${didContract.deployTxData.public.contractAddress}`);
    return didContract;
};
export const deploy = async (providers, privateState) => {
    getLogger().info("Deploying Midnight DID contract...");
    const didContract = await deployContract(providers, {
        compiledContract: midnightDIDCompiledContract,
        privateStateId: MidnightDIDPrivateStateId,
        initialPrivateState: privateState,
    });
    bindPrivateStateProvider(providers, didContract.deployTxData.public.contractAddress);
    // `deployContract` receives the initial state for proving; this explicit
    // post-bind save makes the controller key durable for subsequent sessions.
    await savePrivateState(providers, privateState);
    getLogger().info(`Deployed contract at address: ${didContract.deployTxData.public.contractAddress}`);
    return didContract;
};
export const createDID = async (providers, privateState) => {
    getLogger().info("Creating DID...");
    const didContract = await deploy(providers, privateState);
    getLogger().info(`Created DID at contract address: ${didContract.deployTxData.public.contractAddress}`);
    return didContract;
};
//# sourceMappingURL=contract-lifecycle-operations.js.map