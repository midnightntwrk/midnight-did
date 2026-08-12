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
  .pipe(
    z.string().check(
      z.regex(/^[0-9a-fA-F]+$/),
      z.refine((s) => s.length === 64, "Contract address must be 64 hex chars"),
    ),
    z.transform((value) => value.toLowerCase()),
  )
  .brand("ContractAddress");

export type ContractAddress = z.infer<typeof ContractAddressHexSchema>;

export const OffchainStateHashHexSchema = z
  .pipe(
    z.string().check(z.regex(/^[0-9a-fA-F]{64}$/)),
    z.transform((value) => value.toLowerCase()),
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
  const identifier =
    network === MidnightNetwork.Offchain
      ? (OffchainStateHashHexSchema.parse(String(contractAddress)) as string)
      : parseContractAddress(String(contractAddress));
  return `did:midnight:${net}:${identifier}` as MidnightDIDString;
}

// did:midnight:<network>:<contract_address>
// did:midnight:offchain:<state_hash>[:<encoded_state>]
export const MidnightDIDSchema = z
  .pipe(
    z.string().check(
      z.startsWith("did:midnight:"),
      z.refine((val) => {
        const parts = val.split(":");
        return parts[2] === "offchain"
          ? parts.length === 4 || parts.length === 5
          : parts.length === 4;
      }, "Invalid Midnight DID format"),
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
        const [, , net, , state] = val.split(":");
        return (
          net !== "offchain" ||
          state === undefined ||
          (/^[A-Za-z0-9_-]+$/u.test(state) && state.length % 4 !== 1)
        );
      }, "Invalid offchain Midnight DID state encoding"),
    ),
    z.transform((value) => {
      const parts = value.split(":");
      parts[3] = parts[3]?.toLowerCase() ?? "";
      return parts.join(":");
    }),
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
  const canonicalDid = parseMidnightDIDString(did);
  const [, , net, addr] = canonicalDid.split(":");
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
