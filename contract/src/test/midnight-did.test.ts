import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import {
  ContractAddressSchema,
  MidnightNetwork,
  parseMidnightDID
} from "../midnight-did";

const VALID_ID =
  "0200c14874a279e61d4bf4eebff76f46fada3afbb0183dff21e741975143dcbdabab";

describe("parseMidnightDID", () => {
  it("fails if network segment is missing", () => {
    const input = `did:midnight:${VALID_ID}`;
    try {
      parseMidnightDID(input);
      throw new Error("Expected error");
    } catch (e) {
      expect((e as ZodError).issues[0].message).toMatch(
        /Invalid MidnightDID string/
      );
    }
  });

  it("parses did:midnight:mainnet:<id>", () => {
    const input = `did:midnight:mainnet:${VALID_ID}`;
    const result = parseMidnightDID(input);

    expect(result.raw).toBe(input);
    expect(result.network).toBe(MidnightNetwork.Mainnet);
    expect(result.id).toBe(VALID_ID);
  });

  it("parses did:midnight:testnet:<id>", () => {
    const input = `did:midnight:testnet:${VALID_ID}`;
    const result = parseMidnightDID(input);

    expect(result.raw).toBe(input);
    expect(result.network).toBe(MidnightNetwork.Testnet);
    expect(result.id).toBe(VALID_ID);
  });

  it("parses did:midnight:undeployed:<id>", () => {
    const input = `did:midnight:undeployed:${VALID_ID}`;
    const result = parseMidnightDID(input);

    expect(result.raw).toBe(input);
    expect(result.network).toBe(MidnightNetwork.Undeployed);
    expect(result.id).toBe(VALID_ID);
  });

  it("fails if id is invalid hex", () => {
    const input = "did:midnight:mainnet:not_hex_id";
    try {
      parseMidnightDID(input);
      throw new Error("Expected error");
    } catch (e) {
      expect((e as ZodError).issues[0].message).toMatch(
        /Invalid contract address/
      );
    }
  });

  it("fails if prefix is wrong", () => {
    const input = `bad:midnight:testnet:${VALID_ID}`;
    try {
      parseMidnightDID(input);
      throw new Error("Expected error");
    } catch (e) {
      //TODO: make the errors better
      expect((e as ZodError).issues[1].message).toMatch(
        /Invalid MidnightDID string/
      );
    }
  });

  it("fails if method is wrong", () => {
    const input = `did:other:testnet:${VALID_ID}`;
    try {
      parseMidnightDID(input);
      throw new Error("Expected error");
    } catch (e) {
      expect((e as ZodError).issues[0].message).toMatch(
        /Invalid MidnightDID string/
      );
    }
  });

  it("fails if network is invalid", () => {
    const input = `did:midnight:foobar:${VALID_ID}`;
    try {
      parseMidnightDID(input);
      throw new Error("Expected error");
    } catch (e) {
      expect((e as ZodError).issues[0].message).toMatch(
        /Invalid MidnightDID string/
      );
    }
  });

  it("fails if too many parts", () => {
    const input = `did:midnight:testnet:extra:${VALID_ID}`;
    try {
      parseMidnightDID(input);
      throw new Error("Expected error");
    } catch (e) {
      expect((e as ZodError).issues[0].message).toMatch(
        /Invalid MidnightDID string/
      );
    }
  });
});

// ContractAddressSchema validation tests
describe("ContractAddressSchema", () => {
  it("accepts a valid 68-character lowercase hex string", () => {
    const input =
      "0200c14874a279e61d4bf4eebff76f46fada3afbb0183dff21e741975143dcbdabab";
    expect(() => ContractAddressSchema.parse(input)).not.toThrow();
  });

  it("parse contract address from the read contract", () => {
    const input =
      "02000e1869b98d33a81d4b22ed91c71f36275916911ff0d4972022153c01561f7cea";
    expect(() => ContractAddressSchema.parse(input)).not.toThrow();
  });

  it("rejects a string shorter than 66 characters", () => {
    const input = "abcd";
    try {
      ContractAddressSchema.parse(input);
      throw new Error("Expected error");
    } catch (e) {
      expect((e as ZodError).issues[0].message).toMatch(
        /Invalid contract address/
      );
    }
  });

  it("rejects a string longer than 66 characters", () => {
    const input = "a".repeat(67);
    try {
      ContractAddressSchema.parse(input);
      throw new Error("Expected error");
    } catch (e) {
      expect((e as ZodError).issues[0].message).toMatch(
        /Invalid contract address/
      );
    }
  });

  it("rejects a string with invalid characters (non-hex)", () => {
    const input = "z".repeat(66);
    try {
      ContractAddressSchema.parse(input);
      throw new Error("Expected error");
    } catch (e) {
      expect((e as ZodError).issues[0].message).toMatch(
        /Invalid contract address/
      );
    }
  });

  it("rejects a string with uppercase hex characters", () => {
    const input =
      "0200C14874A279E61D4BF4EEBFF76F46FADA3AFBB0183DFF21E741975143DCBDAB";
    try {
      ContractAddressSchema.parse(input);
      throw new Error("Expected error");
    } catch (e) {
      expect((e as ZodError).issues[0].message).toMatch(
        /Invalid contract address/
      );
    }
  });
});
