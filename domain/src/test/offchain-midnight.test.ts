import { describe, expect, it } from "vitest";

import { CurveType, KeyType, parseDIDDocument } from "../did-document.js";
import {
  createOffchainMidnightDIDStringFromState,
  createPortableOffchainMidnightDIDUrl,
  decodeOffchainMidnightDIDState,
  encodeOffchainMidnightDIDState,
  type OffchainMidnightDIDState,
  offchainStateToDidDocument,
  parsePortableOffchainMidnightDIDUrl,
} from "../offchain-midnight.js";

const sampleState: OffchainMidnightDIDState = {
  version: 1,
  alsoKnownAs: ["https://example.org/holders/alice"],
  verificationMethod: [
    {
      id: "#holder-key-1",
      publicKeyJwk: {
        kty: KeyType.EC,
        crv: CurveType.Jubjub,
        x: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        y: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
      relationships: {
        authentication: true,
        assertionMethod: true,
        keyAgreement: false,
        capabilityInvocation: false,
        capabilityDelegation: false,
      },
    },
  ],
  service: [
    {
      id: "#profile",
      type: "LinkedDomains",
      serviceEndpoint: "https://example.org/profile/alice",
    },
  ],
};

describe("offchain Midnight DID helpers", () => {
  it("encodes and decodes Compact-native state deterministically", () => {
    const first = encodeOffchainMidnightDIDState(sampleState);
    const second = encodeOffchainMidnightDIDState(sampleState);
    expect(first).toEqual(second);
    expect(decodeOffchainMidnightDIDState(first)).toEqual(sampleState);
  });

  it("creates a stable offchain Midnight DID subject from state", () => {
    const did = createOffchainMidnightDIDStringFromState(sampleState);
    expect(did).toMatch(/^did:midnight:offchain:[0-9a-f]{64}$/);
  });

  it("creates and parses a portable offchain Midnight DID URL", () => {
    const portable = createPortableOffchainMidnightDIDUrl(sampleState);
    const parsed = parsePortableOffchainMidnightDIDUrl(portable);
    expect(parsed.did).toBe(
      createOffchainMidnightDIDStringFromState(sampleState),
    );
    expect(parsed.encodedState.payload.length).toBeGreaterThan(20);
  });

  it("rejects a portable DID URL when the state payload is tampered", () => {
    const portable = createPortableOffchainMidnightDIDUrl(sampleState);
    const [did, query] = portable.split("?");
    const statePayload = new URLSearchParams(query).get("state");
    expect(statePayload).toBeTruthy();
    const middle = Math.floor((statePayload?.length ?? 0) / 2);
    const original = statePayload?.[middle] ?? "A";
    const replacement = original === "A" ? "B" : "A";
    const tamperedPayload = `${statePayload?.slice(0, middle) ?? ""}${replacement}${statePayload?.slice(middle + 1) ?? ""}`;
    const tampered = `${did}?state=${tamperedPayload}`;
    expect(() => parsePortableOffchainMidnightDIDUrl(tampered)).toThrow(
      /state does not match the DID state hash/,
    );
  });

  it("derives a DID document from the offchain state", () => {
    const did = createOffchainMidnightDIDStringFromState(sampleState);
    const doc = offchainStateToDidDocument(did, sampleState);
    expect(doc.id).toBe(did);
    expect(doc.authentication).toEqual(["#holder-key-1"]);
    expect(doc.assertionMethod).toEqual(["#holder-key-1"]);
    expect(doc.service?.[0]?.id).toBe("#profile");
    expect(parseDIDDocument(doc).id).toBe(did);
  });

  it("round-trips Ed25519 and P-256 verification methods", () => {
    const stateWithMultipleKeys: OffchainMidnightDIDState = {
      version: 1,
      alsoKnownAs: [],
      verificationMethod: [
        ...sampleState.verificationMethod,
        {
          id: "#ed25519-1",
          publicKeyJwk: {
            kty: KeyType.OKP,
            crv: CurveType.Ed25519,
            x: "ccccccccccccccccccccccccccccccccccccccccccc",
          },
          relationships: {
            authentication: true,
            assertionMethod: false,
            keyAgreement: false,
            capabilityInvocation: false,
            capabilityDelegation: false,
          },
        },
        {
          id: "#p256-1",
          publicKeyJwk: {
            kty: KeyType.EC,
            crv: CurveType.P256,
            x: "ddddddddddddddddddddddddddddddddddddddddddd",
            y: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          },
          relationships: {
            authentication: false,
            assertionMethod: true,
            keyAgreement: true,
            capabilityInvocation: false,
            capabilityDelegation: false,
          },
        },
      ],
      service: [],
    };

    const encoded = encodeOffchainMidnightDIDState(stateWithMultipleKeys);
    expect(decodeOffchainMidnightDIDState(encoded)).toEqual(
      stateWithMultipleKeys,
    );
  });

  it("rejects malformed encoded state payloads", () => {
    const encoded = encodeOffchainMidnightDIDState(sampleState);
    const bytes = Buffer.from(
      encoded.payload.replaceAll("-", "+").replaceAll("_", "/") +
        "=".repeat((4 - (encoded.payload.length % 4)) % 4),
      "base64",
    );

    const wrongMagic = Buffer.from(bytes);
    wrongMagic[0] = 0x00;
    expect(() =>
      decodeOffchainMidnightDIDState({
        ...encoded,
        payload: wrongMagic
          .toString("base64")
          .replaceAll("+", "-")
          .replaceAll("/", "_")
          .replace(/=+$/u, ""),
      }),
    ).toThrow(/unexpected magic header/);

    const truncated = bytes.subarray(0, bytes.length - 1);
    expect(() =>
      decodeOffchainMidnightDIDState({
        ...encoded,
        payload: Buffer.from(truncated)
          .toString("base64")
          .replaceAll("+", "-")
          .replaceAll("/", "_")
          .replace(/=+$/u, ""),
      }),
    ).toThrow(
      /chunk exceeds payload length|trailing bytes|shorter than the header|ended before uint32 field/,
    );

    expect(() =>
      decodeOffchainMidnightDIDState({
        ...encoded,
        payload: "!",
      }),
    ).toThrow(/not valid unpadded base64url/);
  });

  it("rejects state shapes beyond the prototype bounds", () => {
    expect(() =>
      encodeOffchainMidnightDIDState({
        ...sampleState,
        alsoKnownAs: new Array(5).fill("https://example.org/x"),
      }),
    ).toThrow(/alsoKnownAs must contain at most 4 entries/);
    expect(() =>
      encodeOffchainMidnightDIDState({
        ...sampleState,
        service: new Array(5).fill(sampleState.service[0]),
      }),
    ).toThrow(/service must contain at most 4 entries/);
    expect(() =>
      encodeOffchainMidnightDIDState({
        ...sampleState,
        verificationMethod: new Array(5).fill(
          sampleState.verificationMethod[0],
        ),
      }),
    ).toThrow(/verificationMethod must contain at most 4 entries/);
  });
});
