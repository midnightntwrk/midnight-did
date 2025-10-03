import { z } from "zod/v4-mini";

export enum MidnightNetwork {
  Undeployed = "Undeployed",
  DevNet = "DevNet",
  Testnet = "Testnet",
  Mainnet = "Mainnet",
}

const ContractAddressHexSchema = z
  .string()
  .check(
    z.regex(/^[0-9a-fA-F]+$/),
    z.refine((s) => s.length === 68, "Contract address must be 68 hex chars"),
  )
  .brand("ContractAddress");

export type ContractAddress = z.infer<typeof ContractAddressHexSchema>;

export function parseContractAddress(input: string): ContractAddress {
  return ContractAddressHexSchema.parse(input) as ContractAddress;
}

export function createMidnightDIDString(
  contractAddress: ContractAddress,
  network: MidnightNetwork,
): string {
  const net = network.toLowerCase();
  return `did:midnight:${net}:${contractAddress}`;
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
      return ["undeployed", "devnet", "testnet", "mainnet"].includes(net);
    }, "Unknown network in Midnight DID"),
    z.refine((val) => {
      const addr = val.split(":")[3] ?? "";
      return /^[0-9a-fA-F]{68}$/.test(addr);
    }, "Invalid contract address in Midnight DID"),
  )
  .brand("MidnightDID");

export type MidnightDIDString = z.infer<typeof MidnightDIDSchema>;

export function parseMidnightDIDString(input: string): MidnightDIDString {
  return MidnightDIDSchema.parse(input) as MidnightDIDString;
}

export function parseMidnightDID(did: MidnightDIDString): {
  network: MidnightNetwork;
  id: ContractAddress;
} {
  const [, , net, addr] = did.split(":");
  const network =
    net === "devnet"
      ? MidnightNetwork.DevNet
      : net === "testnet"
        ? MidnightNetwork.Testnet
        : net === "mainnet"
          ? MidnightNetwork.Mainnet
          : MidnightNetwork.Undeployed;
  return { network, id: addr as ContractAddress };
}
