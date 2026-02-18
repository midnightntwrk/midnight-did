import { describe, expect, it } from "vitest";

import {
  type ContractAddress,
  createMidnightDIDString,
  MidnightNetwork,
  parseContractAddress,
  parseMidnightDID,
  parseMidnightDIDString,
} from "../midnight";

describe("Midnight DID utilities", () => {
  const validAddress =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123" as ContractAddress;
  const validAddressUpperCase =
    "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123" as ContractAddress;

  describe("parseContractAddress", () => {
    it("parses a valid 68-character hex address", () => {
      const result = parseContractAddress(validAddress);
      expect(result).toBe(validAddress);
    });

    it("accepts uppercase hex characters", () => {
      const result = parseContractAddress(validAddressUpperCase);
      expect(result).toBe(validAddressUpperCase);
    });

    it("accepts mixed case hex characters", () => {
      const mixedCase =
        "0123456789AbCdEf0123456789AbCdEf0123456789AbCdEf0123456789AbCdEf0123";
      const result = parseContractAddress(mixedCase);
      expect(result).toBe(mixedCase);
    });

    it("throws on address with non-hex characters", () => {
      const invalidAddress =
        "012345678gabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123";
      expect(() => parseContractAddress(invalidAddress)).toThrow();
    });

    it("throws on address that is too short", () => {
      const shortAddress = "0123456789abcdef";
      expect(() => parseContractAddress(shortAddress)).toThrow();
    });

    it("throws on address that is too long", () => {
      const longAddress =
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
      expect(() => parseContractAddress(longAddress)).toThrow();
    });

    it("throws on empty string", () => {
      expect(() => parseContractAddress("")).toThrow();
    });
  });

  describe("createMidnightDIDString", () => {
    it("creates DID string for Undeployed network", () => {
      const result = createMidnightDIDString(
        validAddress,
        MidnightNetwork.Undeployed,
      );
      expect(result).toBe(`did:midnight:undeployed:${validAddress}`);
    });

    it("creates DID string for DevNet network", () => {
      const result = createMidnightDIDString(
        validAddress,
        MidnightNetwork.DevNet,
      );
      expect(result).toBe(`did:midnight:devnet:${validAddress}`);
    });

    it("creates DID string for Testnet network", () => {
      const result = createMidnightDIDString(
        validAddress,
        MidnightNetwork.Testnet,
      );
      expect(result).toBe(`did:midnight:testnet:${validAddress}`);
    });

    it("creates DID string for Mainnet network", () => {
      const result = createMidnightDIDString(
        validAddress,
        MidnightNetwork.Mainnet,
      );
      expect(result).toBe(`did:midnight:mainnet:${validAddress}`);
    });
  });

  describe("parseMidnightDIDString", () => {
    it("parses a valid Midnight DID for devnet", () => {
      const did = `did:midnight:devnet:${validAddress}`;
      const result = parseMidnightDIDString(did);
      expect(result).toBe(did);
    });

    it("parses a valid Midnight DID for testnet", () => {
      const did = `did:midnight:testnet:${validAddress}`;
      const result = parseMidnightDIDString(did);
      expect(result).toBe(did);
    });

    it("parses a valid Midnight DID for mainnet", () => {
      const did = `did:midnight:mainnet:${validAddress}`;
      const result = parseMidnightDIDString(did);
      expect(result).toBe(did);
    });

    it("parses a valid Midnight DID for undeployed", () => {
      const did = `did:midnight:undeployed:${validAddress}`;
      const result = parseMidnightDIDString(did);
      expect(result).toBe(did);
    });

    it("throws on DID without did:midnight: prefix", () => {
      const invalidDID = `did:example:testnet:${validAddress}`;
      expect(() => parseMidnightDIDString(invalidDID)).toThrow();
    });

    it("throws on DID with invalid network", () => {
      const invalidDID = `did:midnight:invalidnet:${validAddress}`;
      expect(() => parseMidnightDIDString(invalidDID)).toThrow();
    });

    it("throws on DID with too few parts", () => {
      const invalidDID = `did:midnight:testnet`;
      expect(() => parseMidnightDIDString(invalidDID)).toThrow();
    });

    it("throws on DID with too many parts", () => {
      const invalidDID = `did:midnight:testnet:${validAddress}:extra`;
      expect(() => parseMidnightDIDString(invalidDID)).toThrow();
    });

    it("throws on DID with invalid contract address", () => {
      const invalidDID = `did:midnight:testnet:invalid`;
      expect(() => parseMidnightDIDString(invalidDID)).toThrow();
    });

    it("throws on DID with short contract address", () => {
      const invalidDID = `did:midnight:testnet:0123456789abcdef`;
      expect(() => parseMidnightDIDString(invalidDID)).toThrow();
    });

    it("throws on DID with non-hex contract address", () => {
      const invalidAddr =
        "012345678gabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123";
      const invalidDID = `did:midnight:testnet:${invalidAddr}`;
      expect(() => parseMidnightDIDString(invalidDID)).toThrow();
    });
  });

  describe("parseMidnightDID", () => {
    it("parses network and contract address for devnet", () => {
      const did = parseMidnightDIDString(`did:midnight:devnet:${validAddress}`);
      const result = parseMidnightDID(did);
      expect(result.network).toBe(MidnightNetwork.DevNet);
      expect(result.id).toBe(validAddress);
    });

    it("parses network and contract address for testnet", () => {
      const did = parseMidnightDIDString(
        `did:midnight:testnet:${validAddress}`,
      );
      const result = parseMidnightDID(did);
      expect(result.network).toBe(MidnightNetwork.Testnet);
      expect(result.id).toBe(validAddress);
    });

    it("parses network and contract address for mainnet", () => {
      const did = parseMidnightDIDString(
        `did:midnight:mainnet:${validAddress}`,
      );
      const result = parseMidnightDID(did);
      expect(result.network).toBe(MidnightNetwork.Mainnet);
      expect(result.id).toBe(validAddress);
    });

    it("parses network and contract address for undeployed", () => {
      const did = parseMidnightDIDString(
        `did:midnight:undeployed:${validAddress}`,
      );
      const result = parseMidnightDID(did);
      expect(result.network).toBe(MidnightNetwork.Undeployed);
      expect(result.id).toBe(validAddress);
    });
  });

  describe("MidnightNetwork enum", () => {
    it("has all expected network values", () => {
      expect(MidnightNetwork.Undeployed).toBe("Undeployed");
      expect(MidnightNetwork.DevNet).toBe("DevNet");
      expect(MidnightNetwork.Testnet).toBe("Testnet");
      expect(MidnightNetwork.Mainnet).toBe("Mainnet");
    });
  });
});
