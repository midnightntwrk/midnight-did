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
import {
  serviceToLedger,
  verificationMethodToLedger,
} from "../ledger-mappers.js";
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
const blsG1Key =
  "BgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYG";

describe("ledger mappers", () => {
  it("preserves complete service URL identity when mapping to ledger", () => {
    expect(
      serviceToLedger(didContract, {
        id: "/routing#messaging",
        type: "DIDCommMessaging",
        serviceEndpoint: "https://example.com/messaging",
      }),
    ).toMatchObject({
      id: `${didSubject}/routing#messaging`,
      typ: "DIDCommMessaging",
    });

    expect(
      serviceToLedger(didContract, {
        id: "?service=messaging",
        type: "DIDCommMessaging",
        serviceEndpoint: "https://example.com/messaging",
      }),
    ).toMatchObject({
      id: `${didSubject}?service=messaging`,
    });

    expect(() =>
      serviceToLedger(didContract, {
        id: "did:example:other#messaging",
        type: "DIDCommMessaging",
        serviceEndpoint: "https://example.com/messaging",
      }),
    ).toThrow(/must match the current DID/);
  });

  it("rejects duplicate service endpoints before writing ledger state", () => {
    expect(() =>
      serviceToLedger(didContract, {
        id: "#duplicate-endpoints",
        type: "DIDCommMessaging",
        serviceEndpoint: [
          "https://EXAMPLE.com:443/messages",
          "https://example.com/messages",
        ],
      }),
    ).toThrow(/Invalid serviceEndpoint/);
  });

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

  it("normalizes BLS12-381 OKP keys to the ledger y sentinel", () => {
    expect(
      verificationMethodToLedger(
        didContract,
        createVerificationMethod({
          id: `${didSubject}#key-bls12381-g1`,
          type: VerificationMethodType.JsonWebKey,
          controller: didSubject,
          publicKeyJwk: {
            kty: KeyType.OKP,
            crv: CurveType.BLS12381G1,
            x: blsG1Key,
          },
        }),
      ).publicKeyJwk,
    ).toEqual({
      kty: DIDContract.KeyType.OKP,
      crv: DIDContract.CurveType.BLS12381G1,
      x: blsG1Key,
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

    expect(() =>
      verificationMethodToLedger(didContract, {
        id: `${didSubject}#key-bls-with-y`,
        type: VerificationMethodType.JsonWebKey,
        controller: didSubject,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.BLS12381G1,
          x: blsG1Key,
          y: key,
        },
      } as any),
    ).toThrow(/OKP keys must not include a y coordinate/);

    expect(() =>
      verificationMethodToLedger(didContract, {
        id: `${didSubject}#key-with-private-d`,
        type: VerificationMethodType.JsonWebKey,
        controller: didSubject,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          x: key,
          d: key,
        },
      } as any),
    ).toThrow(/private key material/);
  });
});
