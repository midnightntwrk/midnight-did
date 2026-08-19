import {
  createLongFormOffchainMidnightDIDString,
  createOffchainMidnightDIDStringFromState,
  CurveType,
  KeyType,
  type OffchainMidnightDIDState,
} from "@midnight-ntwrk/midnight-did-domain";
import { describe, expect, it } from "vitest";

import { parseMidnightDIDDocument } from "../midnight-did-document.js";
import {
  assertOffchainMidnightDID,
  resolveLongFormOffchainMidnightDID,
} from "../offchain-midnight-did.js";

const state: OffchainMidnightDIDState = {
  version: 1,
  alsoKnownAs: [],
  verificationMethod: [
    {
      id: "#issuer-key-1",
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
  service: [],
};

describe("offchain Midnight DID facade", () => {
  it("asserts that a DID uses the offchain Midnight network", async () => {
    const did =
      "did:midnight:offchain:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    expect(assertOffchainMidnightDID(did)).toBe(did);
    expect(() =>
      assertOffchainMidnightDID(
        "did:midnight:devnet:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ),
    ).toThrow(/offchain/);
  });

  it("resolves a long-form offchain Midnight DID", () => {
    const resolved = resolveLongFormOffchainMidnightDID(
      createLongFormOffchainMidnightDIDString(state),
    );
    expect(resolved.didDocument.id).toBe(resolved.did);
    expect(resolved.did).toMatch(/^did:midnight:offchain:[0-9a-f]{64}:/);
    expect(resolved.didDocument.controller).toBe(resolved.did);
    expect(resolved.didDocument.authentication).toEqual([
      `${resolved.did}#issuer-key-1`,
    ]);
    expect(resolved.didDocument.assertionMethod).toEqual([
      `${resolved.did}#issuer-key-1`,
    ]);
    expect(resolved.didDocument.verificationMethod).toHaveLength(1);
    expect(resolved.didDocument.verificationMethod?.[0]?.controller).toBe(
      resolved.did,
    );
    expect(parseMidnightDIDDocument(resolved.didDocument).id).toBe(
      resolved.did,
    );
    expect(resolved.didDocumentMetadata.versionId).toBe("1");
  });

  it("rejects duplicate verification method ids in offchain state", () => {
    const duplicateState: OffchainMidnightDIDState = {
      ...state,
      verificationMethod: [
        state.verificationMethod[0],
        state.verificationMethod[0],
      ],
    };

    expect(() =>
      createLongFormOffchainMidnightDIDString(duplicateState),
    ).toThrow(/verificationMethod ids must be unique/);
  });

  it("rejects duplicate service ids in offchain state", () => {
    const duplicateState: OffchainMidnightDIDState = {
      ...state,
      service: [
        {
          id: "#service-1",
          type: "LinkedDomains",
          serviceEndpoint: "https://example.com",
        },
        {
          id: "#service-1",
          type: "LinkedDomains",
          serviceEndpoint: "https://example.org",
        },
      ],
    };

    expect(() =>
      createLongFormOffchainMidnightDIDString(duplicateState),
    ).toThrow(/service ids must be unique/);
  });

  it("rejects short-form offchain DIDs in the long-form resolver", () => {
    expect(() =>
      resolveLongFormOffchainMidnightDID(
        createOffchainMidnightDIDStringFromState(state),
      ),
    ).toThrow(/must include encoded state/);
  });
});
