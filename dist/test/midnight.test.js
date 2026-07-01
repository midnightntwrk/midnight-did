import { describe, expect, it } from "vitest";
import { createMidnightDIDString, MidnightNetwork, parseContractAddress, parseMidnightDID, parseMidnightDIDString, } from "../midnight.js";
const sampleAddress = "c".repeat(64);
describe("Midnight DID helpers", () => {
    it("parses contract addresses and builds DID strings", () => {
        const address = parseContractAddress(sampleAddress);
        expect(address).toBe(sampleAddress);
        const did = createMidnightDIDString(address, MidnightNetwork.DevNet);
        expect(did).toBe(`did:midnight:devnet:${sampleAddress}`);
    });
    it("rejects invalid contract address strings", () => {
        expect(() => parseContractAddress("zz")).toThrow();
        expect(() => parseContractAddress("c".repeat(63))).toThrow();
    });
    it("parses and validates Midnight DID strings", () => {
        const did = `did:midnight:testnet:${sampleAddress}`;
        const parsed = parseMidnightDIDString(did);
        expect(parsed).toBe(did);
        const components = parseMidnightDID(parsed);
        expect(components.network).toBe(MidnightNetwork.Testnet);
        expect(components.id).toBe(sampleAddress);
    });
    it("rejects DID strings with invalid network or address", () => {
        expect(() => parseMidnightDIDString(`did:midnight:unknown:${sampleAddress}`)).toThrow(/Unknown network/);
        expect(() => parseMidnightDIDString(`did:midnight:devnet:${"c".repeat(63)}`)).toThrow(/Invalid method-specific identifier/);
        expect(() => parseMidnightDIDString(`did:midnight:offchain:${"C".repeat(64)}`)).toThrow(/lowercase hex/);
        expect(() => parseMidnightDIDString(`did:midnight:offchain:${"c".repeat(64)}:not+base64url`)).toThrow(/state encoding/);
    });
    it("maps undeployed network strings to the correct enum", () => {
        const did = `did:midnight:undeployed:${sampleAddress}`;
        const { network } = parseMidnightDID(parseMidnightDIDString(did));
        expect(network).toBe(MidnightNetwork.Undeployed);
    });
    it("maps preview and preprod network strings to the correct enum", () => {
        const previewDid = `did:midnight:preview:${sampleAddress}`;
        const preprodDid = `did:midnight:preprod:${sampleAddress}`;
        expect(parseMidnightDID(parseMidnightDIDString(previewDid)).network).toBe(MidnightNetwork.Preview);
        expect(parseMidnightDID(parseMidnightDIDString(preprodDid)).network).toBe(MidnightNetwork.Preprod);
    });
    it("maps offchain network strings to the correct enum", () => {
        const did = `did:midnight:offchain:${sampleAddress}`;
        expect(parseMidnightDID(parseMidnightDIDString(did)).network).toBe(MidnightNetwork.Offchain);
    });
    it("accepts long-form offchain network strings with encoded state", () => {
        const did = `did:midnight:offchain:${sampleAddress}:AQIDBA`;
        const parsed = parseMidnightDID(parseMidnightDIDString(did));
        expect(parsed.network).toBe(MidnightNetwork.Offchain);
        expect(parsed.id).toBe(sampleAddress);
    });
});
//# sourceMappingURL=midnight.test.js.map