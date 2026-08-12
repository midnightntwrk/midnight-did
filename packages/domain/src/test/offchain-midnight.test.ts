import { describe, expect, it } from "vitest";

import { CurveType, KeyType, parseDIDDocument } from "../did-document.js";
import {
  createLongFormOffchainMidnightDIDString,
  createOffchainMidnightDIDStringFromState,
  decodeOffchainMidnightDIDState,
  encodeOffchainMidnightDIDState,
  type OffchainMidnightDIDState,
  offchainStateToDidDocument,
  parseLongFormOffchainMidnightDIDString,
  parseOffchainStateHash,
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
        x: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        y: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE",
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

const toBase64Url = (bytes: Uint8Array): string =>
  Buffer.from(bytes)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");

const fromBase64UrlUnsafe = (value: string): Uint8Array => {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return new Uint8Array(Buffer.from(`${normalized}${padding}`, "base64"));
};

const createNonCanonicalBase64UrlVariant = (canonical: string): string => {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  for (let index = canonical.length - 1; index >= 0; index -= 1) {
    for (const candidate of alphabet) {
      if (candidate === canonical[index]) continue;
      const variant = `${canonical.slice(0, index)}${candidate}${canonical.slice(index + 1)}`;
      if (
        toBase64Url(fromBase64UrlUnsafe(variant)) === canonical &&
        variant !== canonical
      ) {
        return variant;
      }
    }
  }
  throw new Error("Unable to create non-canonical base64url variant");
};

const sampleVector = {
  state: sampleState,
  encodedState:
    "TU9EMQAAAC0AAAABAQAAACFodHRwczovL2V4YW1wbGUub3JnL2hvbGRlcnMvYWxpY2UAAAAAAAAAAAAAAAAAAAABAQAAAA0jaG9sZGVyLWtleS0xAAAAAQEAAAArQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQQAAACtBUUVCQVFFQkFRRUJBUUVCQVFFQkFRRUJBUUVCQVFFQkFRRUJBUUVCQVFFAAAAAQMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAQAAAAgjcHJvZmlsZQAAAA1MaW5rZWREb21haW5zAAAAIWh0dHBzOi8vZXhhbXBsZS5vcmcvcHJvZmlsZS9hbGljZQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  shortDid:
    "did:midnight:offchain:3c08b85758d973a6002942c730d077ede51920c184927aaf010562035203fc21",
} as const;

const sampleLongFormDid = `${sampleVector.shortDid}:${sampleVector.encodedState}`;

describe("offchain Midnight DID helpers", () => {
  it("matches the published offchain DID encoding test vector", () => {
    expect(encodeOffchainMidnightDIDState(sampleVector.state)).toEqual({
      encoding: "midnight-offchain-did-state-v1.base64url",
      payload: sampleVector.encodedState,
    });
    expect(createOffchainMidnightDIDStringFromState(sampleVector.state)).toBe(
      sampleVector.shortDid,
    );
    expect(createLongFormOffchainMidnightDIDString(sampleVector.state)).toBe(
      sampleLongFormDid,
    );
  });

  it("normalizes uppercase offchain state hashes", () => {
    const longForm = createLongFormOffchainMidnightDIDString(sampleState);
    const parts = longForm.split(":");
    const uppercaseHash = parts[3]?.toUpperCase();
    const uppercaseDid = `${parts.slice(0, 3).join(":")}:${uppercaseHash}:${parts[4]}`;

    expect(parseOffchainStateHash(uppercaseHash ?? "")).toBe(
      parts[3]?.toLowerCase(),
    );
    expect(parseLongFormOffchainMidnightDIDString(uppercaseDid).did).toBe(
      longForm,
    );
  });

  it("canonicalizes offchain DID document subjects", () => {
    const did = createOffchainMidnightDIDStringFromState(sampleState);
    const parts = did.split(":");
    const uppercaseDid = `${parts.slice(0, 3).join(":")}:${parts[3]?.toUpperCase()}`;
    const document = offchainStateToDidDocument(
      uppercaseDid as never,
      sampleState,
    );

    expect(document.id).toBe(did);
    expect(document.controller).toBe(did);
    expect(document.verificationMethod[0]?.controller).toBe(did);
  });

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

  it("creates and parses a self-contained long-form offchain Midnight DID", () => {
    const longForm = createLongFormOffchainMidnightDIDString(sampleState);
    const parsed = parseLongFormOffchainMidnightDIDString(longForm);
    const decoded = decodeOffchainMidnightDIDState(parsed.encodedState);
    const document = offchainStateToDidDocument(parsed.did, decoded);

    expect(longForm).toMatch(/^did:midnight:offchain:[0-9a-f]{64}:/);
    expect(longForm).not.toContain("?state=");
    expect(parsed.did).toBe(longForm);
    expect(parsed.did).toBe(
      createLongFormOffchainMidnightDIDString(sampleState),
    );
    expect(parsed.encodedState.payload.length).toBeGreaterThan(20);
    expect(decoded).toEqual(sampleState);
    expect(document.id).toBe(longForm);
  });

  it("rejects the hash-only short form when encoded state is required", () => {
    expect(() =>
      parseLongFormOffchainMidnightDIDString(
        createOffchainMidnightDIDStringFromState(sampleState),
      ),
    ).toThrow(/must include encoded state/);
  });

  it("rejects the old DID URL query state shape", () => {
    const encoded = encodeOffchainMidnightDIDState(sampleState);
    const shortForm = createOffchainMidnightDIDStringFromState(sampleState);
    expect(() =>
      parseLongFormOffchainMidnightDIDString(
        `${shortForm}?state=${encoded.payload}`,
      ),
    ).toThrow(/Invalid method-specific identifier/);
  });

  it("rejects empty long-form encoded state", () => {
    const shortForm = createOffchainMidnightDIDStringFromState(sampleState);
    expect(() =>
      parseLongFormOffchainMidnightDIDString(`${shortForm}:`),
    ).toThrow(/state encoding/);
  });

  it("rejects non-base64url long-form state before hash validation", () => {
    const shortForm = createOffchainMidnightDIDStringFromState(sampleState);
    expect(() =>
      parseLongFormOffchainMidnightDIDString(`${shortForm}:not+base64url`),
    ).toThrow(/state encoding/);
  });

  it("rejects non-canonical base64url long-form state", () => {
    const longForm = createLongFormOffchainMidnightDIDString(sampleState);
    const parts = longForm.split(":");
    const variant = createNonCanonicalBase64UrlVariant(parts[4] ?? "");
    expect(variant).not.toBe(parts[4]);
    expect(fromBase64UrlUnsafe(variant)).toEqual(
      fromBase64UrlUnsafe(parts[4] ?? ""),
    );

    expect(() =>
      parseLongFormOffchainMidnightDIDString(
        `${parts.slice(0, 4).join(":")}:${variant}`,
      ),
    ).toThrow(/canonical unpadded base64url/);
  });

  it("rejects a long-form DID when the state payload is tampered", () => {
    const longForm = createLongFormOffchainMidnightDIDString(sampleState);
    const parts = longForm.split(":");
    const statePayload = parts[4] ?? "";
    expect(statePayload).not.toBe("");
    const middle = Math.floor((statePayload?.length ?? 0) / 2);
    const original = statePayload?.[middle] ?? "A";
    const replacement = original === "A" ? "B" : "A";
    const tamperedPayload = `${statePayload?.slice(0, middle) ?? ""}${replacement}${statePayload?.slice(middle + 1) ?? ""}`;
    const tampered = `${parts.slice(0, 4).join(":")}:${tamperedPayload}`;
    expect(() => parseLongFormOffchainMidnightDIDString(tampered)).toThrow(
      /state does not match the DID state hash/,
    );
  });

  it("omits absent optional members from an offchain DID document", () => {
    const state = {
      ...sampleState,
      alsoKnownAs: [],
      service: [],
    };
    const did = createOffchainMidnightDIDStringFromState(state);
    const doc = offchainStateToDidDocument(did, state);

    expect(doc).not.toHaveProperty("alsoKnownAs");
    expect(doc).not.toHaveProperty("service");
    expect(JSON.stringify(doc)).not.toContain("null");
    expect(parseDIDDocument(doc).id).toBe(did);
  });

  it("derives a DID document from the offchain state", () => {
    const did = createOffchainMidnightDIDStringFromState(sampleState);
    const doc = offchainStateToDidDocument(did, sampleState);
    expect(doc.id).toBe(did);
    expect(doc.authentication).toEqual(["#holder-key-1"]);
    expect(doc.assertionMethod).toEqual(["#holder-key-1"]);
    expect(doc).not.toHaveProperty("keyAgreement");
    expect(doc).not.toHaveProperty("capabilityInvocation");
    expect(doc).not.toHaveProperty("capabilityDelegation");
    expect(doc.service?.[0]?.id).toBe("#profile");
    expect(parseDIDDocument(doc).id).toBe(did);
  });

  it("round-trips Ed25519, P-256, X25519, secp256k1, and BLS12-381 verification methods", () => {
    const ed25519 = {
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
    };
    const p256 = {
      id: "#p256-1",
      publicKeyJwk: {
        kty: KeyType.EC,
        crv: CurveType.P256,
        x: "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI",
        y: "AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM",
      },
      relationships: {
        authentication: false,
        assertionMethod: true,
        keyAgreement: true,
        capabilityInvocation: false,
        capabilityDelegation: false,
      },
    };
    const x25519 = {
      id: "#x25519-1",
      publicKeyJwk: {
        kty: KeyType.OKP,
        crv: CurveType.X25519,
        x: "BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ",
      },
      relationships: {
        authentication: false,
        assertionMethod: false,
        keyAgreement: true,
        capabilityInvocation: false,
        capabilityDelegation: false,
      },
    };
    const secp256k1 = {
      id: "#secp256k1-1",
      publicKeyJwk: {
        kty: KeyType.EC,
        crv: CurveType.Secp256k1,
        x: "ggggggggggggggggggggggggggggggggggggggggggg",
        y: "BQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU",
      },
      relationships: {
        authentication: true,
        assertionMethod: false,
        keyAgreement: false,
        capabilityInvocation: false,
        capabilityDelegation: false,
      },
    };
    const bls12381G1 = {
      id: "#bls12381-g1-1",
      publicKeyJwk: {
        kty: KeyType.OKP,
        crv: CurveType.BLS12381G1,
        x: "BgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYG",
      },
      relationships: {
        authentication: false,
        assertionMethod: true,
        keyAgreement: false,
        capabilityInvocation: false,
        capabilityDelegation: false,
      },
    };
    const bls12381G2 = {
      id: "#bls12381-g2-1",
      publicKeyJwk: {
        kty: KeyType.OKP,
        crv: CurveType.BLS12381G2,
        x: "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcH",
      },
      relationships: {
        authentication: false,
        assertionMethod: true,
        keyAgreement: false,
        capabilityInvocation: false,
        capabilityDelegation: false,
      },
    };

    for (const verificationMethod of [
      [...sampleState.verificationMethod, ed25519, p256, x25519],
      [...sampleState.verificationMethod, ed25519, p256, secp256k1],
      [...sampleState.verificationMethod, bls12381G1, bls12381G2],
    ]) {
      const stateWithMultipleKeys: OffchainMidnightDIDState = {
        version: 1,
        alsoKnownAs: [],
        verificationMethod,
        service: [],
      };

      const encoded = encodeOffchainMidnightDIDState(stateWithMultipleKeys);
      expect(decodeOffchainMidnightDIDState(encoded)).toEqual(
        stateWithMultipleKeys,
      );
    }
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
