import { describe, expect, it } from "vitest";

import {
  CurveType,
  KeyType,
  parseService,
  VerificationMethodRelationType,
  VerificationMethodType
} from "../did-document";
import {
  assertOperationsContractCompatible,
  DomainToLedger
} from "../domain-to-ledger";
import { OperationBuilder } from "../ledger-operation-builder";
import { LedgerToDomain } from "../ledger-to-domain";
import {
  CurveType as LedgerCurveType,
  KeyType as LedgerKeyType,
  VerificationMethodRelation as LedgerVerificationMethodRelation,
  VerificationMethodType as LedgerVerificationMethodType
} from "../managed/did/contract/index.cjs";
import { MidnightNetwork, parseContractAddress } from "../midnight-did";
import { MidnightDIDSimulator } from "./midnight-did-simulator";

describe("LedgerToDomain mappings", () => {
  it("maps KeyType including OKP", () => {
    expect(LedgerToDomain.KeyTypeMap[LedgerKeyType.EC]).toBe(KeyType.EC);
    expect(LedgerToDomain.KeyTypeMap[LedgerKeyType.RSA]).toBe(KeyType.RSA);
    expect(LedgerToDomain.KeyTypeMap[LedgerKeyType.oct]).toBe(KeyType.oct);
    expect(LedgerToDomain.KeyTypeMap[LedgerKeyType.OKP]).toBe(KeyType.OKP);
  });

  it("maps CurveType", () => {
    expect(LedgerToDomain.CurveTypeMap[LedgerCurveType.ed25519]).toBe(
      CurveType.ed25519
    );
    expect(LedgerToDomain.CurveTypeMap[LedgerCurveType.Jubjub]).toBe(
      CurveType.Jubjub
    );
  });

  it("maps VerificationMethodType and Relation", () => {
    expect(
      LedgerToDomain.VerificationMethodTypeMap[
        LedgerVerificationMethodType.Undefined
      ]
    ).toBe(VerificationMethodType.Undefined);
    expect(
      LedgerToDomain.VerificationMethodTypeMap[
        LedgerVerificationMethodType.JsonWebKey
      ]
    ).toBe(VerificationMethodType.JsonWebKey);

    expect(
      LedgerToDomain.VerificationMethodRelationMap[
        LedgerVerificationMethodRelation.Authentication
      ]
    ).toBe(VerificationMethodRelationType.Authentication);
  });
});

describe("LedgerToDomain helpers", () => {
  it("converts PublicKeyJwk", () => {
    const out = LedgerToDomain.publicKeyJwk({
      kty: LedgerKeyType.OKP,
      crv: LedgerCurveType.ed25519,
      x: 7n,
      y: 9n
    });
    expect(out.kty).toBe(KeyType.OKP);
    expect(out.crv).toBe(CurveType.ed25519);
    expect(out.x).toBe(7n);
    expect(out.y).toBe(9n);
  });

  it("converts service and filters blanks", () => {
    const svc = LedgerToDomain.service({
      id: "svc-1",
      type: "DIDCommV2",
      serviceEndpoint: ["https://a", "", "", ""]
    });
    expect(svc.id).toBe("svc-1");
    expect(Array.isArray(svc.serviceEndpoint)).toBe(true);
    expect((svc.serviceEndpoint as string[]).length).toBe(1);
    expect((svc.serviceEndpoint as string[])[0]).toBe("https://a");
  });
});

describe("LedgerToDomain higher-level", () => {
  it("toJSON returns plain structure", () => {
    const sim = new MidnightDIDSimulator();
    const ledger = sim.getLedger();
    const json = LedgerToDomain.toJSON(ledger) as any;
    expect(typeof json.id).toBe("string");
    expect(typeof json.version).toBe("number");
    expect(Array.isArray(json.verificationMethods)).toBe(true);
    expect(Array.isArray(json.authenticationRelation)).toBe(true);
    expect(Array.isArray(json.services)).toBe(true);
  });

  it("ledgerStateToDIDDocument builds a DID Document from ledger", () => {
    const sim = new MidnightDIDSimulator();
    const addr = "0".repeat(68);
    const did = `did:midnight:devnet:${addr}`;
    // add method, relation, and service
    const operations = [
      OperationBuilder.addVerificationMethod({
        verificationMethod: {
          id: `${did}#key-1`,
          type: LedgerVerificationMethodType.JsonWebKey,
          publicKeyJwk: {
            kty: LedgerKeyType.EC,
            crv: LedgerCurveType.ed25519,
            x: 1n,
            y: 2n
          }
        }
      }),
      OperationBuilder.addVerificationMethodRelation({
        relation: LedgerVerificationMethodRelation.Authentication,
        methodId: `${did}#key-1`
      }),
      OperationBuilder.addService({
        service: {
          id: "svc-1",
          type: "SVC-1",
          serviceEndpoint: ["https://x", "", "", ""]
        }
      }),
      OperationBuilder.addService({
        service: {
          id: "didcomm-1",
          type: "DIDCommV2",
          serviceEndpoint: ["https://d", "", "", ""]
        }
      })
    ];

    assertOperationsContractCompatible(operations);

    sim.applyOperations(operations);

    const doc = LedgerToDomain.ledgerStateToDIDDocument(
      sim.getLedger(),
      MidnightNetwork.DevNet,
      parseContractAddress(addr)
    );

    expect(doc["@context"]).toContain("https://www.w3.org/ns/did/v1");
    expect(doc.id.startsWith("did:midnight:devnet:")).toBe(true);
    expect(doc.controller).toBeDefined();
    expect(doc.verificationMethod?.length).toBe(1);
    expect(doc.authentication?.length).toBe(1);
    expect(doc.service?.length).toBe(2);
  });
});
