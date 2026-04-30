import { z } from "zod/v4-mini";

export enum MidnightNetwork {
  Undeployed = "Undeployed",
  DevNet = "DevNet",
  Testnet = "Testnet",
  Mainnet = "Mainnet",
  Preview = "Preview",
  Preprod = "Preprod",
  Offchain = "Offchain",
}

export const ContractAddressHexSchema = z
  .string()
  .check(
    z.regex(/^[0-9a-fA-F]+$/),
    z.refine((s) => s.length === 64, "Contract address must be 64 hex chars"),
  )
  .brand("ContractAddress");

export type ContractAddress = z.infer<typeof ContractAddressHexSchema>;

export const OffchainStateHashHexSchema = z
  .string()
  .check(
    z.regex(/^[0-9a-f]{64}$/),
    z.refine(
      (value) => value === value.toLowerCase(),
      "Offchain state hash must use lowercase hex",
    ),
  )
  .brand("OffchainStateHash");

export type OffchainStateHashHex = z.infer<typeof OffchainStateHashHexSchema>;

export function parseContractAddress(input: string): ContractAddress {
  return ContractAddressHexSchema.parse(input) as ContractAddress;
}

export function createMidnightDIDString(
  contractAddress: ContractAddress | OffchainStateHashHex,
  network: MidnightNetwork,
): MidnightDIDString {
  const net = network.toLowerCase();
  return `did:midnight:${net}:${contractAddress}` as MidnightDIDString;
}

// did:midnight:<network>:<contract_address>
export const MidnightDIDSchema = z
  .string()
  .check(
    z.startsWith("did:midnight:"),
    z.refine(
      (val) => val.split(":").length === 4,
      "Invalid Midnight DID format",
    ),
    z.refine((val) => {
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
    }, "Unknown network in Midnight DID"),
    z.refine((val) => {
      const identifier = val.split(":")[3] ?? "";
      return /^[0-9a-fA-F]{64}$/.test(identifier);
    }, "Invalid method-specific identifier in Midnight DID"),
    z.refine((val) => {
      const [, , net, identifier] = val.split(":");
      return net !== "offchain" || identifier === identifier.toLowerCase();
    }, "Offchain Midnight DID identifiers must use lowercase hex"),
  )
  .brand("MidnightDID");

export type MidnightDIDString = z.infer<typeof MidnightDIDSchema>;

export function parseMidnightDIDString(input: string): MidnightDIDString {
  return MidnightDIDSchema.parse(input) as MidnightDIDString;
}

export function parseMidnightDID(did: MidnightDIDString): {
  network: MidnightNetwork;
  id: ContractAddress | OffchainStateHashHex;
} {
  const [, , net, addr] = did.split(":");
  const network =
    net === "devnet"
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
    id:
      network === MidnightNetwork.Offchain
        ? (addr as OffchainStateHashHex)
        : (addr as ContractAddress),
  };
}
