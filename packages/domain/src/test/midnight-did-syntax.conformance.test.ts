import { describe, expect, it } from "vitest";

import { CurveType, KeyType } from "../did-document.js";
import { parseMidnightDID, parseMidnightDIDString } from "../midnight.js";
import {
  createLongFormOffchainMidnightDIDString,
  type OffchainMidnightDIDState,
  parseLongFormOffchainMidnightDIDString,
} from "../offchain-midnight.js";
import {
  invalidSyntaxFixtures,
  validLedgerDids,
  validOffchainShortDid,
  validOffchainSyntacticLongDid,
  validOffchainSyntacticLongDidWithUrlSafeChars,
} from "./fixtures/midnight-did-syntax.js";

const offchainState: OffchainMidnightDIDState = {
  version: 1,
  alsoKnownAs: [],
  verificationMethod: [
    {
      id: "#key-1",
      publicKeyJwk: {
        kty: KeyType.EC,
        crv: CurveType.Jubjub,
        x: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        y: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE",
      },
      relationships: {
        authentication: true,
        assertionMethod: false,
        keyAgreement: false,
        capabilityInvocation: false,
        capabilityDelegation: false,
      },
    },
  ],
  service: [],
};

describe("DID Core syntax conformance fixtures", () => {
  it.each(validLedgerDids)("accepts ledger DID %s", (did) => {
    expect(parseMidnightDIDString(did)).toBe(did);
  });

  it("accepts both offchain short and syntactically valid long forms", () => {
    expect(parseMidnightDIDString(validOffchainShortDid)).toBe(
      validOffchainShortDid,
    );
    expect(parseMidnightDIDString(validOffchainSyntacticLongDid)).toBe(
      validOffchainSyntacticLongDid,
    );
    expect(
      parseMidnightDIDString(validOffchainSyntacticLongDidWithUrlSafeChars),
    ).toBe(validOffchainSyntacticLongDidWithUrlSafeChars);
    const longForm = createLongFormOffchainMidnightDIDString(offchainState);
    expect(parseLongFormOffchainMidnightDIDString(longForm).did).toBe(longForm);
  });

  it("canonicalizes ledger hexadecimal case to lowercase", () => {
    const lower = `did:midnight:testnet:${"abcdef01".repeat(8)}`;
    const upper = lower
      .toUpperCase()
      .replace("DID:MIDNIGHT:TESTNET", "did:midnight:testnet");
    expect(parseMidnightDIDString(lower)).toBe(lower);
    expect(parseMidnightDIDString(upper)).toBe(lower);
    const mixed = `did:midnight:testnet:${"0123456789AbCdEf".repeat(4)}`;
    expect(parseMidnightDIDString(mixed)).toBe(mixed.toLowerCase());
    expect(upper).not.toBe(lower);
    expect(parseMidnightDID(parseMidnightDIDString(upper)).id).toBe(
      lower.split(":")[3],
    );
  });

  it.each(invalidSyntaxFixtures)("rejects $label", ({ did, error }) => {
    expect(() => parseMidnightDIDString(did)).toThrow(error);
  });

  it("rejects an offchain long form whose encoded state hash does not match", () => {
    const longForm = createLongFormOffchainMidnightDIDString(offchainState);
    const [, , , , payload] = longForm.split(":");
    const mismatched = `did:midnight:offchain:${"0".repeat(64)}:${payload}`;
    expect(() => parseLongFormOffchainMidnightDIDString(mismatched)).toThrow(
      /state does not match the DID state hash/,
    );
  });
});
