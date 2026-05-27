// This file is part of midnightntwrk/midnight-did.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Buffer } from "node:buffer";

import {
  deriveJubjubPublicKeyFromSeed,
  payloadToJubjubDigest,
  signJubjubPayloadFromSeed
} from "@midnight-ntwrk/midnight-did-jubjub-schnorr";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { beforeEach, describe, expect, it } from "vitest";

import * as ContractExports from "../index.js";
import {
  CurveType,
  KeyType,
  pureCircuits,
  VerificationMethodRelation,
  VerificationMethodType
} from "../managed/did/contract/index.js";
import { DIDSimulator } from "./did-simulator.js";

setNetworkId("undeployed");

const keyBytes = (seed: number): Uint8Array =>
  new Uint8Array(Array.from({ length: 32 }, (_, i) => (seed + i) & 0xff));

describe("DID smart contract", () => {
  it("properly initializes ledger state and private state", () => {
    const simulator = new DIDSimulator();
    const initialLedgerState = simulator.getLedger();
    expect(initialLedgerState.contractVersion).toEqual(1n);
    expect(initialLedgerState.controllerPublicKey).toBeInstanceOf(Uint8Array);
    expect(initialLedgerState.controllerPublicKey.length).toBe(32);
    expect(initialLedgerState.id.bytes).toBeInstanceOf(Uint8Array);
    expect(initialLedgerState.id.bytes.length).toBeGreaterThan(0);
    expect(initialLedgerState.active).toEqual(true);
    expect(initialLedgerState.created).toBeGreaterThan(0n);
    expect(initialLedgerState.updated).toBeGreaterThanOrEqual(
      initialLedgerState.created
    );
    expect(initialLedgerState.deactivated).toEqual(false);
    expect(initialLedgerState.version).toEqual(0n);
    expect(initialLedgerState.operationCount).toEqual(0n);
    const initialPrivateState = simulator.getPrivateState();
    expect(initialPrivateState.secretKey).toBeInstanceOf(Uint8Array);
    expect(initialPrivateState.secretKey.length).toEqual(32);
    const derivedPublicKey = pureCircuits.publicKey(
      initialPrivateState.secretKey
    );
    expect(derivedPublicKey).toEqual(initialLedgerState.controllerPublicKey);
  });

  it("re-exports the managed contract bundle", () => {
    expect(ContractExports.DIDContract).toBeDefined();
  });

  it("verifies shared Jubjub Schnorr digests through the DID contract", () => {
    const simulator = new DIDSimulator();
    const seed = new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1));
    const payload = Buffer.from("midnight-did-contract-jubjub-payload", "utf8");
    const publicKey = deriveJubjubPublicKeyFromSeed(seed);
    const signature = signJubjubPayloadFromSeed(seed, payload);
    const digest = payloadToJubjubDigest(payload);

    expect(() =>
      simulator.contract.impureCircuits.verifyJubjubDigestSignature(
        simulator.circuitContext,
        publicKey,
        { r: signature.announcement, s: signature.response },
        digest
      )
    ).not.toThrow();

    expect(() =>
      simulator.contract.impureCircuits.verifyJubjubDigestSignature(
        simulator.circuitContext,
        publicKey,
        { r: signature.announcement, s: signature.response + 1n },
        digest
      )
    ).toThrow();
  });

  describe("Verification Methods", () => {
    let simulator: DIDSimulator;

    beforeEach(() => {
      simulator = new DIDSimulator();
    });

    it("should add a verification method", () => {
      simulator.addVerificationMethod({
        id: "#key-1",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          x: keyBytes(12345),
          y: keyBytes(67890)
        }
      });

      const ledger = simulator.getLedger();
      expect(ledger.verificationMethods.member("#key-1")).toEqual(true);
      expect(ledger.verificationMethods.size()).toEqual(1n);
      expect(ledger.version).toEqual(1n);
      expect(ledger.operationCount).toEqual(1n);

      const vm = ledger.verificationMethods.lookup("#key-1");
      expect(vm.id).toEqual("#key-1");
      expect(vm.typ).toEqual(VerificationMethodType.JsonWebKey);
      expect(vm.publicKeyJwk.kty).toEqual(KeyType.OKP);
      expect(vm.publicKeyJwk.crv).toEqual(CurveType.Ed25519);
      expect(vm.publicKeyJwk.x).toEqual(keyBytes(12345));
      expect(vm.publicKeyJwk.y).toEqual(keyBytes(67890));
    });

    it("should reject non-JsonWebKey verification methods", () => {
      expect(() =>
        simulator.addVerificationMethod({
          id: "#key-1",
          typ: VerificationMethodType.Undefined,
          publicKeyJwk: {
            kty: KeyType.OKP,
            crv: CurveType.Ed25519,
            x: keyBytes(12345),
            y: keyBytes(67890)
          }
        })
      ).toThrow();
    });

    it("should reject unsupported key type profiles", () => {
      expect(() =>
        simulator.addVerificationMethod({
          id: "#key-rsa",
          typ: VerificationMethodType.JsonWebKey,
          publicKeyJwk: {
            kty: KeyType.RSA,
            crv: CurveType.Ed25519,
            x: keyBytes(12345),
            y: keyBytes(67890)
          }
        })
      ).toThrow();
    });

    it("should reject unsupported key/curve combinations", () => {
      expect(() =>
        simulator.addVerificationMethod({
          id: "#key-ec-invalid",
          typ: VerificationMethodType.JsonWebKey,
          publicKeyJwk: {
            kty: KeyType.EC,
            crv: CurveType.Ed25519,
            x: keyBytes(12345),
            y: keyBytes(67890)
          }
        })
      ).toThrow();
    });

    it("should add an EC P-256 verification method", () => {
      simulator.addVerificationMethod({
        id: "#key-p256",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.EC,
          crv: CurveType.P256,
          x: keyBytes(12345),
          y: keyBytes(67890)
        }
      });

      const ledger = simulator.getLedger();
      const vm = ledger.verificationMethods.lookup("#key-p256");
      expect(vm.publicKeyJwk.kty).toEqual(KeyType.EC);
      expect(vm.publicKeyJwk.crv).toEqual(CurveType.P256);
    });

    it("should add X25519 and secp256k1 verification methods", () => {
      simulator.addVerificationMethod({
        id: "#key-x25519",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.X25519,
          x: keyBytes(10),
          y: keyBytes(0)
        }
      });
      simulator.addVerificationMethod({
        id: "#key-secp256k1",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.EC,
          crv: CurveType.Secp256k1,
          x: keyBytes(20),
          y: keyBytes(21)
        }
      });

      expect(
        simulator.getLedger().verificationMethods.lookup("#key-x25519")
          .publicKeyJwk.crv
      ).toEqual(CurveType.X25519);
      expect(
        simulator.getLedger().verificationMethods.lookup("#key-secp256k1")
          .publicKeyJwk.crv
      ).toEqual(CurveType.Secp256k1);
    });

    it("converts only Jubjub byte coordinates to field values", () => {
      const oneLittleEndian = new Uint8Array(32);
      oneLittleEndian[0] = 1;
      const twoTo248LittleEndian = new Uint8Array(32);
      twoTo248LittleEndian[31] = 1;

      expect(
        pureCircuits.publicKeyJwkToJubjubFields({
          kty: KeyType.EC,
          crv: CurveType.Jubjub,
          x: new Uint8Array(32).fill(1),
          y: new Uint8Array(32).fill(2)
        })
      ).toEqual([
        BigInt(
          "454086624460063511464984254936031011189294057512315937409637584344757371137"
        ),
        BigInt(
          "908173248920127022929968509872062022378588115024631874819275168689514742274"
        )
      ]);
      expect(
        pureCircuits.publicKeyJwkToJubjubFields({
          kty: KeyType.EC,
          crv: CurveType.Jubjub,
          x: oneLittleEndian,
          y: twoTo248LittleEndian
        })
      ).toEqual([
        1n,
        BigInt(
          "452312848583266388373324160190187140051835877600158453279131187530910662656"
        )
      ]);
      expect(() =>
        pureCircuits.publicKeyJwkToJubjubFields({
          kty: KeyType.EC,
          crv: CurveType.Jubjub,
          x: new Uint8Array(32).fill(255),
          y: new Uint8Array(32)
        })
      ).toThrow(/greater than the maximum value of a Field/);
      expect(() =>
        pureCircuits.publicKeyJwkToJubjubFields({
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          x: new Uint8Array(32),
          y: new Uint8Array(32)
        })
      ).toThrow(/Jubjub keys must use EC/);
    });

    it("rejects Jubjub verification methods with coordinates above the Field maximum", () => {
      expect(() =>
        simulator.addVerificationMethod({
          id: "#key-jubjub-overflow",
          typ: VerificationMethodType.JsonWebKey,
          publicKeyJwk: {
            kty: KeyType.EC,
            crv: CurveType.Jubjub,
            x: new Uint8Array(32).fill(255),
            y: new Uint8Array(32)
          }
        })
      ).toThrow(/greater than the maximum value of a Field/);
    });

    it("should update a verification method", () => {
      // First add
      simulator.addVerificationMethod({
        id: "#key-1",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          x: keyBytes(111),
          y: keyBytes(222)
        }
      });

      // Then update
      simulator.updateVerificationMethod({
        id: "#key-1",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          x: keyBytes(999),
          y: keyBytes(888)
        }
      });

      const ledger = simulator.getLedger();
      const vm = ledger.verificationMethods.lookup("#key-1");
      expect(vm.publicKeyJwk.x).toEqual(keyBytes(999));
      expect(vm.publicKeyJwk.y).toEqual(keyBytes(888));
      expect(ledger.version).toEqual(2n);
      expect(ledger.operationCount).toEqual(2n);
    });

    it("should update a verification method to EC P-256", () => {
      simulator.addVerificationMethod({
        id: "#key-update-p256",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          x: keyBytes(111),
          y: keyBytes(0)
        }
      });

      simulator.updateVerificationMethod({
        id: "#key-update-p256",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.EC,
          crv: CurveType.P256,
          x: keyBytes(999),
          y: keyBytes(888)
        }
      });

      const ledger = simulator.getLedger();
      const vm = ledger.verificationMethods.lookup("#key-update-p256");
      expect(vm.publicKeyJwk.kty).toEqual(KeyType.EC);
      expect(vm.publicKeyJwk.crv).toEqual(CurveType.P256);
      expect(vm.publicKeyJwk.x).toEqual(keyBytes(999));
      expect(vm.publicKeyJwk.y).toEqual(keyBytes(888));
    });

    it("should remove a verification method", () => {
      // First add
      simulator.addVerificationMethod({
        id: "#key-1",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          x: keyBytes(111),
          y: keyBytes(222)
        }
      });

      // Then remove
      simulator.removeVerificationMethod("#key-1");

      const ledger = simulator.getLedger();
      expect(ledger.verificationMethods.member("#key-1")).toEqual(false);
      expect(ledger.verificationMethods.size()).toEqual(0n);
      expect(ledger.version).toEqual(2n);
    });

    it("should fail to remove a verification method while relations still exist", () => {
      simulator.addVerificationMethod({
        id: "#key-2",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          x: keyBytes(333),
          y: keyBytes(444)
        }
      });
      simulator.addVerificationMethodRelation(
        VerificationMethodRelation.Authentication,
        "#key-2"
      );

      expect(() => simulator.removeVerificationMethod("#key-2")).toThrow(
        /still referenced in authenticationRelation/
      );
    });

    it("should remove verification method and its relations", () => {
      // Add verification method
      simulator.addVerificationMethod({
        id: "#key-1",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          x: keyBytes(111),
          y: keyBytes(222)
        }
      });

      // Add relations
      simulator.addVerificationMethodRelation(
        VerificationMethodRelation.Authentication,
        "#key-1"
      );
      simulator.addVerificationMethodRelation(
        VerificationMethodRelation.AssertionMethod,
        "#key-1"
      );

      // Verify relations exist
      let ledger = simulator.getLedger();
      expect(ledger.authenticationRelation.member("#key-1")).toEqual(true);
      expect(ledger.assertionMethodRelation.member("#key-1")).toEqual(true);

      // Remove relations first (new decomposed pattern)
      simulator.removeVerificationMethodRelation(
        VerificationMethodRelation.Authentication,
        "#key-1"
      );
      simulator.removeVerificationMethodRelation(
        VerificationMethodRelation.AssertionMethod,
        "#key-1"
      );

      // Then remove verification method
      simulator.removeVerificationMethod("#key-1");

      // Verify method and relations are gone
      ledger = simulator.getLedger();
      expect(ledger.verificationMethods.member("#key-1")).toEqual(false);
      expect(ledger.authenticationRelation.member("#key-1")).toEqual(false);
      expect(ledger.assertionMethodRelation.member("#key-1")).toEqual(false);
    });
  });

  describe("Verification Method Relations", () => {
    let simulator: DIDSimulator;

    beforeEach(() => {
      simulator = new DIDSimulator();
      // Add a verification method first
      simulator.addVerificationMethod({
        id: "#key-1",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          x: keyBytes(111),
          y: keyBytes(222)
        }
      });
    });

    it("should add Authentication relation", () => {
      simulator.addVerificationMethodRelation(
        VerificationMethodRelation.Authentication,
        "#key-1"
      );

      const ledger = simulator.getLedger();
      expect(ledger.authenticationRelation.member("#key-1")).toEqual(true);
      expect(ledger.authenticationRelation.size()).toEqual(1n);
    });

    it("should add AssertionMethod relation", () => {
      simulator.addVerificationMethodRelation(
        VerificationMethodRelation.AssertionMethod,
        "#key-1"
      );

      const ledger = simulator.getLedger();
      expect(ledger.assertionMethodRelation.member("#key-1")).toEqual(true);
    });

    it("should add KeyAgreement relation", () => {
      simulator.addVerificationMethodRelation(
        VerificationMethodRelation.KeyAgreement,
        "#key-1"
      );

      const ledger = simulator.getLedger();
      expect(ledger.keyAgreementRelation.member("#key-1")).toEqual(true);
    });

    it("should add CapabilityInvocation relation", () => {
      simulator.addVerificationMethodRelation(
        VerificationMethodRelation.CapabilityInvocation,
        "#key-1"
      );

      const ledger = simulator.getLedger();
      expect(ledger.capabilityInvocationRelation.member("#key-1")).toEqual(
        true
      );
    });

    it("should add CapabilityDelegation relation", () => {
      simulator.addVerificationMethodRelation(
        VerificationMethodRelation.CapabilityDelegation,
        "#key-1"
      );

      const ledger = simulator.getLedger();
      expect(ledger.capabilityDelegationRelation.member("#key-1")).toEqual(
        true
      );
    });

    it("should remove a relation", () => {
      // Add relation
      simulator.addVerificationMethodRelation(
        VerificationMethodRelation.Authentication,
        "#key-1"
      );

      // Remove relation
      simulator.removeVerificationMethodRelation(
        VerificationMethodRelation.Authentication,
        "#key-1"
      );

      const ledger = simulator.getLedger();
      expect(ledger.authenticationRelation.member("#key-1")).toEqual(false);
      expect(ledger.authenticationRelation.size()).toEqual(0n);
    });

    it("should fail when adding the same relation twice", () => {
      simulator.addVerificationMethodRelation(
        VerificationMethodRelation.Authentication,
        "#key-1"
      );
      expect(() =>
        simulator.addVerificationMethodRelation(
          VerificationMethodRelation.Authentication,
          "#key-1"
        )
      ).toThrow();
    });

    it("should fail when removing a relation that does not exist", () => {
      expect(() =>
        simulator.removeVerificationMethodRelation(
          VerificationMethodRelation.Authentication,
          "#key-1"
        )
      ).toThrow();
    });
  });

  describe("Services", () => {
    let simulator: DIDSimulator;

    beforeEach(() => {
      simulator = new DIDSimulator();
    });

    it("should add a service", () => {
      simulator.addService({
        id: "#service-1",
        typ: "MessagingService",
        serviceEndpoint: "https://example.com/messages"
      });

      const ledger = simulator.getLedger();
      expect(ledger.services.member("#service-1")).toEqual(true);
      expect(ledger.services.size()).toEqual(1n);

      const service = ledger.services.lookup("#service-1");
      expect(service.id).toEqual("#service-1");
      expect(service.typ).toEqual("MessagingService");
      expect(service.serviceEndpoint).toEqual("https://example.com/messages");
    });

    it("should update a service", () => {
      // Add service
      simulator.addService({
        id: "#service-1",
        typ: "MessagingService",
        serviceEndpoint: "https://example.com/messages"
      });

      // Update service
      simulator.updateService({
        id: "#service-1",
        typ: "MessagingService",
        serviceEndpoint: "https://new-endpoint.com/messages"
      });

      const ledger = simulator.getLedger();
      const service = ledger.services.lookup("#service-1");
      expect(service.serviceEndpoint).toEqual(
        "https://new-endpoint.com/messages"
      );
      expect(ledger.version).toEqual(2n);
    });

    it("should remove a service", () => {
      // Add service
      simulator.addService({
        id: "#service-1",
        typ: "MessagingService",
        serviceEndpoint: "https://example.com/messages"
      });

      // Remove service
      simulator.removeService("#service-1");

      const ledger = simulator.getLedger();
      expect(ledger.services.member("#service-1")).toEqual(false);
      expect(ledger.services.size()).toEqual(0n);
    });
  });

  describe("AlsoKnownAs", () => {
    let simulator: DIDSimulator;

    beforeEach(() => {
      simulator = new DIDSimulator();
    });

    it("should add an alsoKnownAs value", () => {
      simulator.addAlsoKnownAs("did:example:alternative-id");

      const ledger = simulator.getLedger();
      expect(ledger.alsoKnownAs.member("did:example:alternative-id")).toEqual(
        true
      );
      expect(ledger.alsoKnownAs.size()).toEqual(1n);
      expect(ledger.version).toEqual(1n);
    });

    it("should remove an alsoKnownAs value", () => {
      // Add
      simulator.addAlsoKnownAs("did:example:alternative-id");

      // Remove
      simulator.removeAlsoKnownAs("did:example:alternative-id");

      const ledger = simulator.getLedger();
      expect(ledger.alsoKnownAs.member("did:example:alternative-id")).toEqual(
        false
      );
      expect(ledger.alsoKnownAs.size()).toEqual(0n);
    });

    it("should add multiple alsoKnownAs values", () => {
      simulator.addAlsoKnownAs("alias-1");
      simulator.addAlsoKnownAs("alias-2");

      const ledger = simulator.getLedger();
      expect(ledger.alsoKnownAs.size()).toEqual(2n);
      expect(ledger.alsoKnownAs.member("alias-1")).toEqual(true);
      expect(ledger.alsoKnownAs.member("alias-2")).toEqual(true);
    });
  });

  describe("Deactivation", () => {
    let simulator: DIDSimulator;

    beforeEach(() => {
      simulator = new DIDSimulator();
    });

    it("should deactivate the DID", () => {
      simulator.deactivate();

      const ledger = simulator.getLedger();
      expect(ledger.active).toEqual(false);
      expect(ledger.deactivated).toEqual(true);
      expect(ledger.version).toEqual(1n);
    });

    it("should fail when trying to add verification method after deactivation", () => {
      // Deactivate
      simulator.deactivate();

      // Try to add verification method (should fail)
      expect(() => {
        simulator.addVerificationMethod({
          id: "#key-1",
          typ: VerificationMethodType.JsonWebKey,
          publicKeyJwk: {
            kty: KeyType.OKP,
            crv: CurveType.Ed25519,
            x: keyBytes(111),
            y: keyBytes(222)
          }
        });
      }).toThrow();
    });
  });

  describe("Multiple Operations", () => {
    let simulator: DIDSimulator;

    beforeEach(() => {
      simulator = new DIDSimulator();
    });

    it("should apply multiple operations sequentially", () => {
      simulator.addVerificationMethod({
        id: "#key-1",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          x: keyBytes(111),
          y: keyBytes(222)
        }
      });
      simulator.addVerificationMethodRelation(
        VerificationMethodRelation.Authentication,
        "#key-1"
      );
      simulator.addService({
        id: "#service-1",
        typ: "MessagingService",
        serviceEndpoint: "https://example.com"
      });
      simulator.addAlsoKnownAs("did:example:alias");

      const ledger = simulator.getLedger();
      expect(ledger.verificationMethods.member("#key-1")).toEqual(true);
      expect(ledger.authenticationRelation.member("#key-1")).toEqual(true);
      expect(ledger.services.member("#service-1")).toEqual(true);
      expect(ledger.alsoKnownAs.member("did:example:alias")).toEqual(true);
      expect(ledger.version).toEqual(4n);
      expect(ledger.operationCount).toEqual(4n);
    });

    it("should handle version counter correctly across multiple transactions", () => {
      // Transaction 1
      simulator.addVerificationMethod({
        id: "#key-1",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          x: keyBytes(111),
          y: keyBytes(222)
        }
      });

      expect(simulator.getLedger().version).toEqual(1n);

      // Transaction 2
      simulator.addService({
        id: "#service-1",
        typ: "Test",
        serviceEndpoint: "https://test.com"
      });

      expect(simulator.getLedger().version).toEqual(2n);

      // Transaction 3
      simulator.addAlsoKnownAs("alias-1");
      simulator.addAlsoKnownAs("alias-2");

      const ledger = simulator.getLedger();
      expect(ledger.version).toEqual(4n);
      expect(ledger.operationCount).toEqual(4n);
    });
  });
});
