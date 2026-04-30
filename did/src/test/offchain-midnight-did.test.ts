import {
  createPortableOffchainMidnightDIDUrl,
  CurveType,
  KeyType,
  type OffchainMidnightDIDState,
} from "@midnight-ntwrk/midnight-did-domain";
import { describe, expect, it } from "vitest";

import { parseMidnightDIDDocument } from "../midnight-did-document.js";
import {
  assertOffchainMidnightDID,
  resolvePortableOffchainMidnightDID,
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

  it("resolves a portable offchain Midnight DID URL", () => {
    const resolved = resolvePortableOffchainMidnightDID(
      createPortableOffchainMidnightDIDUrl(state),
    );
    expect(resolved.didDocument.id).toBe(resolved.did);
    expect(parseMidnightDIDDocument(resolved.didDocument).id).toBe(
      resolved.did,
    );
    expect(resolved.state.verificationMethod).toHaveLength(1);
    expect(resolved.didDocumentMetadata.versionId).toBe("1");
  });
});
