import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import {
  createVerificationMethod,
  CurveType,
  KeyType,
  VerificationMethodType,
} from "@midnight-ntwrk/midnight-did-domain";
import {
  getNetworkId,
  setNetworkId,
} from "@midnight-ntwrk/midnight-js-network-id";
import { afterAll, describe, expect, it } from "vitest";

import { getDidSubject } from "../did-subject.js";
import { verificationMethodToLedger } from "../ledger-mappers.js";
import { type DeployedMidnightDIDContract } from "../types.js";

let previousNetworkId: string | undefined;
try {
  previousNetworkId = getNetworkId();
} catch {
  previousNetworkId = undefined;
}
setNetworkId("undeployed");
afterAll(() => {
  if (previousNetworkId !== undefined) {
    setNetworkId(previousNetworkId);
  }
});

const didContract = {
  deployTxData: {
    public: {
      contractAddress:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    },
  },
} as DeployedMidnightDIDContract;

const didSubject = getDidSubject(didContract);
const key = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE";

describe("ledger mappers", () => {
  it("normalizes OKP keys to the ledger y sentinel", () => {
    expect(
      verificationMethodToLedger(
        didContract,
        createVerificationMethod({
          id: `${didSubject}#key-ed25519`,
          type: VerificationMethodType.JsonWebKey,
          controller: didSubject,
          publicKeyJwk: {
            kty: KeyType.OKP,
            crv: CurveType.Ed25519,
            x: key,
          },
        }),
      ).publicKeyJwk,
    ).toEqual({
      kty: DIDContract.KeyType.OKP,
      crv: DIDContract.CurveType.Ed25519,
      x: key,
      y: "",
    });
  });

  it("rejects opaque JWK shapes that would not resolve cleanly", () => {
    expect(() =>
      verificationMethodToLedger(didContract, {
        id: `${didSubject}#key-okp-with-y`,
        type: VerificationMethodType.JsonWebKey,
        controller: didSubject,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          x: key,
          y: key,
        },
      } as any),
    ).toThrow(/OKP keys must not include a y coordinate/);

    expect(() =>
      verificationMethodToLedger(didContract, {
        id: `${didSubject}#key-ec-without-y`,
        type: VerificationMethodType.JsonWebKey,
        controller: didSubject,
        publicKeyJwk: {
          kty: KeyType.EC,
          crv: CurveType.P256,
          x: key,
        },
      } as any),
    ).toThrow(/EC keys must include a y coordinate/);
  });
});
