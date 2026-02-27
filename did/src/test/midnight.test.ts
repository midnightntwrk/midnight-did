import { describe, expect, it } from "vitest";

import {
  createMidnightDIDString,
  MidnightDIDSchema,
  MidnightNetwork,
  parseContractAddress,
  parseMidnightDID,
  parseMidnightDIDString,
} from "../midnight";

const RAW_ADDRESS = "0".repeat(64);
const sampleAddress = parseContractAddress(RAW_ADDRESS);

describe("Midnight utilities", () => {
  it("parses contract addresses", () => {
    const parsed = parseContractAddress(RAW_ADDRESS);
    expect(parsed).toBe(sampleAddress);
  });

  it("rejects malformed contract addresses", () => {
    expect(() => parseContractAddress("1234")).toThrow();
    expect(() => parseContractAddress("g".repeat(64))).toThrow();
  });

  it("creates and parses Midnight DID strings", () => {
    const did = createMidnightDIDString(sampleAddress, MidnightNetwork.DevNet);
    expect(did).toBe(`did:midnight:devnet:${sampleAddress}`);
    const parsed = parseMidnightDIDString(did);
    expect(parsed).toBe(did);
  });

  it("rejects Midnight DIDs with invalid network", () => {
    const invalidDid = `did:midnight:unknown:${sampleAddress}`;
    expect(() => parseMidnightDIDString(invalidDid)).toThrow();
  });

  it("extracts network details from Midnight DID", () => {
    const did = createMidnightDIDString(sampleAddress, MidnightNetwork.Mainnet);
    const parsed = parseMidnightDID(parseMidnightDIDString(did));
    expect(parsed.network).toBe(MidnightNetwork.Mainnet);
    expect(parsed.id).toBe(sampleAddress);
  });

  it("maps auxiliary networks in Midnight DIDs", () => {
    const devnetDid = createMidnightDIDString(
      sampleAddress,
      MidnightNetwork.DevNet,
    );
    const testnetDid = createMidnightDIDString(
      sampleAddress,
      MidnightNetwork.Testnet,
    );
    expect(parseMidnightDID(parseMidnightDIDString(devnetDid)).network).toBe(
      MidnightNetwork.DevNet,
    );
    expect(parseMidnightDID(parseMidnightDIDString(testnetDid)).network).toBe(
      MidnightNetwork.Testnet,
    );
  });

  it("validates schema helper", () => {
    const did = createMidnightDIDString(
      sampleAddress,
      MidnightNetwork.Undeployed,
    );
    expect(() => MidnightDIDSchema.parse(did)).not.toThrow();
  });
});
