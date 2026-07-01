import { describe, expect, it } from "vitest";
import { normalizeServiceEndpointValue, normalizeUriString, } from "../uri-normalization.js";
describe("URI normalization helpers", () => {
    it("normalizes HTTP(S) URIs", () => {
        expect(normalizeUriString("HTTPS://Example.COM:443/path/../home?query=1#Frag")).toBe("https://example.com/home?query=1#Frag");
        expect(normalizeUriString("http://Example.com:80/")).toBe("http://example.com/");
    });
    it("normalizes credentials and preserves non-default ports", () => {
        expect(normalizeUriString("HTTPS://user:pass@Example.COM:444/path")).toBe("https://user:pass@example.com:444/path");
    });
    it("leaves non-HTTP schemes unchanged", () => {
        const did = "did:example:123456";
        expect(normalizeUriString(did)).toBe(did);
    });
    it("returns input when URL parsing fails", () => {
        const value = "http://[invalid";
        expect(normalizeUriString(value)).toBe(value);
    });
    it("normalizes nested service endpoint structures", () => {
        const endpoint = {
            uri: "HTTPS://Example.COM:443/a/../b",
            routingKeys: ["did:example:mediator"],
            nested: [{ uri: "wSs://Sample.org:443/socket" }],
        };
        expect(normalizeServiceEndpointValue(endpoint)).toEqual({
            uri: "https://example.com/b",
            routingKeys: ["did:example:mediator"],
            nested: [{ uri: "wss://sample.org/socket" }],
        });
    });
    it("normalizes arrays of endpoints", () => {
        const endpoints = [
            "HTTPS://Example.com:443/inbox",
            { uri: "Ws://Example.org:80/updates" },
        ];
        expect(normalizeServiceEndpointValue(endpoints)).toEqual([
            "https://example.com/inbox",
            { uri: "ws://example.org/updates" },
        ]);
    });
    it("returns non-string endpoints untouched", () => {
        expect(normalizeServiceEndpointValue(42)).toBe(42);
    });
});
//# sourceMappingURL=uri-normalization.test.js.map