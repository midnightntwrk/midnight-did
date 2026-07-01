import { z } from "zod/v4-mini";
export var MidnightNetwork;
(function (MidnightNetwork) {
    MidnightNetwork["Undeployed"] = "Undeployed";
    MidnightNetwork["DevNet"] = "DevNet";
    MidnightNetwork["Testnet"] = "Testnet";
    MidnightNetwork["Mainnet"] = "Mainnet";
    MidnightNetwork["Preview"] = "Preview";
    MidnightNetwork["Preprod"] = "Preprod";
    MidnightNetwork["Offchain"] = "Offchain";
})(MidnightNetwork || (MidnightNetwork = {}));
export const ContractAddressHexSchema = z
    .string()
    .check(z.regex(/^[0-9a-fA-F]+$/), z.refine((s) => s.length === 64, "Contract address must be 64 hex chars"))
    .brand("ContractAddress");
export const OffchainStateHashHexSchema = z
    .string()
    .check(z.regex(/^[0-9a-f]{64}$/), z.refine((value) => value === value.toLowerCase(), "Offchain state hash must use lowercase hex"))
    .brand("OffchainStateHash");
export function parseContractAddress(input) {
    return ContractAddressHexSchema.parse(input);
}
export function createMidnightDIDString(contractAddress, network) {
    const net = network.toLowerCase();
    return `did:midnight:${net}:${contractAddress}`;
}
// did:midnight:<network>:<contract_address>
// did:midnight:offchain:<state_hash>[:<encoded_state>]
export const MidnightDIDSchema = z
    .string()
    .check(z.startsWith("did:midnight:"), z.refine((val) => {
    const parts = val.split(":");
    return parts[2] === "offchain"
        ? parts.length === 4 || parts.length === 5
        : parts.length === 4;
}, "Invalid Midnight DID format"), z.refine((val) => {
    const [, , net] = val.split(":");
    return [
        "undeployed",
        "devnet",
        "testnet",
        "mainnet",
        "preview",
        "preprod",
        "offchain",
    ].includes(net);
}, "Unknown network in Midnight DID"), z.refine((val) => {
    const identifier = val.split(":")[3] ?? "";
    return /^[0-9a-fA-F]{64}$/.test(identifier);
}, "Invalid method-specific identifier in Midnight DID"), z.refine((val) => {
    const [, , net, identifier] = val.split(":");
    return net !== "offchain" || identifier === identifier.toLowerCase();
}, "Offchain Midnight DID identifiers must use lowercase hex"), z.refine((val) => {
    const [, , net, , state] = val.split(":");
    return (net !== "offchain" ||
        state === undefined ||
        (/^[A-Za-z0-9_-]+$/u.test(state) && state.length % 4 !== 1));
}, "Invalid offchain Midnight DID state encoding"))
    .brand("MidnightDID");
export function parseMidnightDIDString(input) {
    return MidnightDIDSchema.parse(input);
}
export function parseMidnightDID(did) {
    const [, , net, addr] = did.split(":");
    const network = net === "devnet"
        ? MidnightNetwork.DevNet
        : net === "testnet"
            ? MidnightNetwork.Testnet
            : net === "mainnet"
                ? MidnightNetwork.Mainnet
                : net === "preview"
                    ? MidnightNetwork.Preview
                    : net === "preprod"
                        ? MidnightNetwork.Preprod
                        : net === "offchain"
                            ? MidnightNetwork.Offchain
                            : MidnightNetwork.Undeployed;
    return {
        network,
        id: network === MidnightNetwork.Offchain
            ? addr
            : addr,
    };
}
//# sourceMappingURL=midnight.js.map