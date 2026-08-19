import { describe, expect, it } from "vitest";

import { resolveDIDURLReference } from "../did-url.js";

const did =
  "did:midnight:testnet:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("resolveDIDURLReference", () => {
  it.each([
    ["#svc", `${did}#svc`],
    ["/routing", `${did}/routing`],
    ["?service=messaging", `${did}?service=messaging`],
    ["/a#svc", `${did}/a#svc`],
    ["/b#svc", `${did}/b#svc`],
    ["./routing", `${did}/routing`],
    ["../routing", `${did}/routing`],
    ["/routing/", `${did}/routing/`],
    ["/routing//messages", `${did}/routing//messages`],
    ["/routing/./messages", `${did}/routing/messages`],
    ["/routing/../messages", `${did}/messages`],
  ])("resolves %s as %s", (reference, expected) => {
    expect(resolveDIDURLReference(reference, did)).toBe(expected);
  });

  it("normalizes dot segments in absolute DID URLs", () => {
    expect(resolveDIDURLReference(`${did}/routing/../messages`, did)).toBe(
      `${did}/messages`,
    );
    expect(resolveDIDURLReference(`${did}/routing/..#svc`, did)).toBe(
      `${did}/#svc`,
    );
  });

  it("does not collapse distinct path references with the same fragment", () => {
    expect(resolveDIDURLReference("/a#svc", did)).not.toBe(
      resolveDIDURLReference("/b#svc", did),
    );
  });

  it("canonicalizes an equivalent absolute DID subject", () => {
    expect(
      resolveDIDURLReference(`${did.toUpperCase()}#svc`, did, {
        caseInsensitiveDIDSubject: true,
      }),
    ).toBe(`${did}#svc`);
  });

  it("rejects absolute non-DID URLs unless the caller explicitly allows them", () => {
    expect(() =>
      resolveDIDURLReference("https://attacker.example/key#key-1", did),
    ).toThrow(/bound to the current DID/);
    expect(
      resolveDIDURLReference("https://example.com/service", did, {
        allowExternalURL: true,
      }),
    ).toBe("https://example.com/service");
  });

  it("rejects foreign DID URLs by default", () => {
    expect(() =>
      resolveDIDURLReference("did:midnight:testnet:foreign#svc", did),
    ).toThrow(/current DID/);
  });

  it("rejects network-path references", () => {
    expect(() => resolveDIDURLReference("//example.com/service", did)).toThrow(
      /network-path/,
    );
  });
});
