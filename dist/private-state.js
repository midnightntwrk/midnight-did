import { getLogger } from "./api-logger.js";
import { randomBytes } from "./lightweight.js";
import { MidnightDIDPendingControllerPrivateStateId, MidnightDIDPrivateStateId, } from "./types.js";
const isContractAddressUnsetError = (error) => error instanceof Error && error.message.includes("Contract address not set");
export const isRestorableDIDPrivateState = (privateState) => privateState != null &&
    privateState.secretKey instanceof Uint8Array &&
    privateState.secretKey.length === 32;
export const bindPrivateStateProvider = (providers, contractAddress) => {
    providers.privateStateProvider.setContractAddress(contractAddress);
};
export async function restorePrivateState(providers, privateStateId = MidnightDIDPrivateStateId) {
    let providedPrivateState = null;
    try {
        providedPrivateState =
            await providers.privateStateProvider.get(privateStateId);
    }
    catch (error) {
        if (!isContractAddressUnsetError(error)) {
            throw error;
        }
        getLogger().info("Private state restore skipped (contract address not set yet).");
    }
    if (isRestorableDIDPrivateState(providedPrivateState)) {
        getLogger().info("The private state is restored from the privateStateProvider");
        return providedPrivateState;
    }
    return null;
}
export async function requirePrivateState(providers, privateStateId = MidnightDIDPrivateStateId) {
    const privateState = await restorePrivateState(providers, privateStateId);
    if (!isRestorableDIDPrivateState(privateState)) {
        throw new Error("DID controller private state is missing or malformed; import the controller secret before using this contract");
    }
    return privateState;
}
export async function savePrivateState(providers, privateState, privateStateId = MidnightDIDPrivateStateId) {
    await providers.privateStateProvider.set(privateStateId, privateState);
}
export async function initPrivateState(providers) {
    const providedPrivateState = await restorePrivateState(providers);
    if (isRestorableDIDPrivateState(providedPrivateState)) {
        return providedPrivateState;
    }
    getLogger().info("Creating the new private state..");
    const secretKey = randomBytes(32);
    const privateState = { secretKey };
    try {
        await savePrivateState(providers, privateState);
    }
    catch (error) {
        if (isContractAddressUnsetError(error)) {
            getLogger().info("Private state save skipped (contract address not set yet).");
        }
        else {
            throw error;
        }
    }
    return privateState;
}
export async function savePendingControllerPrivateState(providers, privateState) {
    await savePrivateState(providers, privateState, MidnightDIDPendingControllerPrivateStateId);
}
export async function clearPendingControllerPrivateState(providers) {
    await providers.privateStateProvider.remove(MidnightDIDPendingControllerPrivateStateId);
}
export async function recoverPendingControllerPrivateState(providers, options) {
    if (options?.rotationFinalized !== true) {
        throw new Error("Pending controller private state can only be recovered after confirming the key-rotation transaction finalized");
    }
    const pendingPrivateState = await requirePrivateState(providers, MidnightDIDPendingControllerPrivateStateId);
    await savePrivateState(providers, pendingPrivateState);
    await clearPendingControllerPrivateState(providers);
    return pendingPrivateState;
}
//# sourceMappingURL=private-state.js.map