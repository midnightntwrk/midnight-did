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
  pureCircuits as schnorrPureCircuits,
  signJubjubPayloadFromSeed,
  TWO_248
} from "@midnight-ntwrk/midnight-did-jubjub-schnorr";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { beforeEach, describe, expect, it } from "vitest";

import * as ContractExports from "../index.js";
import {
  CurveType,
  KeyType,
  MapMutation,
  pureCircuits,
  SetMutation,
  VerificationMethodRelation,
  VerificationMethodType
} from "../managed/did/contract/index.js";
import { witnesses } from "../witnesses.js";
import { DIDSimulator } from "./did-simulator.js";

setNetworkId("undeployed");

const keyBytes = (seed: number): Uint8Array =>
  new Uint8Array(Array.from({ length: 32 }, (_, i) => (seed + i) & 0xff));

const keyValue = (seed: number): string =>
  Buffer.from(keyBytes(seed)).toString("base64url");

const keyValueOfLength = (seed: number, length: number): string =>
  Buffer.from(
    new Uint8Array(Array.from({ length }, (_, i) => (seed + i) & 0xff))
  ).toString("base64url");

const okpKey = (seed: number) => ({
  x: keyValue(seed),
  y: ""
});

const ecKey = (xSeed: number, ySeed: number) => ({
  x: keyValue(xSeed),
  y: keyValue(ySeed)
});

const COMPACT_FIELD_MODULUS =
  52435875175126190479447740508185965837690552500527637822603658699938581184512n;

describe("DID smart contract", () => {
  it("properly initializes ledger state and private state", () => {
    const simulator = new DIDSimulator();
    const initialLedgerState = simulator.getLedger();
    expect(initialLedgerState.contractVersion).toEqual(1n);
    expect(initialLedgerState.controllerPublicKey.x).toBeTypeOf("bigint");
    expect(initialLedgerState.controllerPublicKey.y).toBeTypeOf("bigint");
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
    expect(initialLedgerState.controllerPublicKey).toEqual(
      ContractExports.deriveControllerPublicKey(initialPrivateState.secretKey)
    );
  });

  it("re-exports the managed contract bundle", () => {
    expect(ContractExports.DIDContract).toBeDefined();
  });

  it("authorizes controller updates with a wallet-local operation-bound signature", () => {
    const simulator = new DIDSimulator();
    const oldSecretKey = simulator.getPrivateState().secretKey;
    const newSecretKey = keyBytes(99);
    const newControllerPublicKey =
      ContractExports.deriveControllerPublicKey(newSecretKey);

    expect(newControllerPublicKey).not.toEqual(
      ContractExports.deriveControllerPublicKey(oldSecretKey)
    );

    simulator.rotateControllerPublicKey(newControllerPublicKey);
    expect(simulator.getLedger().controllerPublicKey).toEqual(
      newControllerPublicKey
    );
    expect(simulator.getLedger().version).toEqual(1n);

    expect(() => simulator.addAlsoKnownAs("did:example:old-secret")).toThrow(
      /Invalid Jubjub Schnorr signature/
    );

    simulator.setPrivateState({ secretKey: newSecretKey });
    simulator.addAlsoKnownAs("did:example:new-secret");
    expect(
      simulator.getLedger().alsoKnownAs.member("did:example:new-secret")
    ).toEqual(true);
    expect(simulator.getLedger().version).toEqual(2n);
  });

  it("rejects controller signatures reused with different operation arguments", () => {
    const simulator = new DIDSimulator();
    const [signature, expectedVersion] =
      simulator.controllerAuthorizationForAddAlsoKnownAs(
        "did:example:intended-update"
      );

    expect(() =>
      simulator.addAlsoKnownAsWithAuthorization(
        "did:example:tampered-update",
        signature,
        expectedVersion
      )
    ).toThrow(/Invalid Jubjub Schnorr signature/);
  });

  it("rejects controller signatures reused with a different operation", () => {
    const simulator = new DIDSimulator();
    const [signature, expectedVersion] =
      simulator.controllerAuthorizationForAddAlsoKnownAs(
        "did:example:intended-update"
      );

    expect(() =>
      simulator.contract.impureCircuits.setService(
        simulator.circuitContext,
        {
          id: "#tampered-service",
          typ: "LinkedDomains",
          serviceEndpoint: "https://example.com"
        },
        MapMutation.Insert,
        signature,
        expectedVersion
      )
    ).toThrow(/Invalid Jubjub Schnorr signature/);
  });

  it("rejects replayed controller authorizations after the DID version changes", () => {
    const simulator = new DIDSimulator();
    const [signature, expectedVersion] =
      simulator.controllerAuthorizationForAddAlsoKnownAs(
        "did:example:replayed-update"
      );

    simulator.addAlsoKnownAs("did:example:first-update");

    expect(() =>
      simulator.addAlsoKnownAsWithAuthorization(
        "did:example:replayed-update",
        signature,
        expectedVersion
      )
    ).toThrow(/Controller authorization version is stale/);
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
          ...okpKey(12345)
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
      expect(vm.publicKeyJwk.x).toEqual(keyValue(12345));
      expect(vm.publicKeyJwk.y).toEqual("");
    });

    it("should reject non-JsonWebKey verification methods", () => {
      expect(() =>
        simulator.addVerificationMethod({
          id: "#key-1",
          typ: VerificationMethodType.Undefined,
          publicKeyJwk: {
            kty: KeyType.OKP,
            crv: CurveType.Ed25519,
            ...okpKey(12345)
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
            ...ecKey(12345, 67890)
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
            ...ecKey(12345, 67890)
          }
        })
      ).toThrow();
    });

    it("should reject Jubjub keys in the opaque verification method circuit", () => {
      expect(() =>
        simulator.addVerificationMethod({
          id: "#key-jubjub-native",
          typ: VerificationMethodType.JsonWebKey,
          publicKeyJwk: {
            kty: KeyType.EC,
            crv: CurveType.Jubjub,
            ...ecKey(12345, 67890)
          }
        })
      ).toThrow(/SchnorrJubjub/);
    });

    it("should add an EC P-256 verification method", () => {
      simulator.addVerificationMethod({
        id: "#key-p256",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.EC,
          crv: CurveType.P256,
          ...ecKey(12345, 67890)
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
          ...okpKey(10)
        }
      });
      simulator.addVerificationMethod({
        id: "#key-secp256k1",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.EC,
          crv: CurveType.Secp256k1,
          ...ecKey(20, 21)
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

    it("should add BLS12-381 OKP verification methods", () => {
      simulator.addVerificationMethod({
        id: "#key-bls12381-g1",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.BLS12381G1,
          x: keyValueOfLength(30, 48),
          y: ""
        }
      });
      simulator.addVerificationMethod({
        id: "#key-bls12381-g2",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.BLS12381G2,
          x: keyValueOfLength(40, 96),
          y: ""
        }
      });

      expect(
        simulator.getLedger().verificationMethods.lookup("#key-bls12381-g1")
          .publicKeyJwk.crv
      ).toEqual(CurveType.BLS12381G1);
      expect(
        simulator.getLedger().verificationMethods.lookup("#key-bls12381-g2")
          .publicKeyJwk.crv
      ).toEqual(CurveType.BLS12381G2);
    });

    it("should add, update, relate, and remove SchnorrJubjub verification methods", () => {
      const seed = new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1));
      const updatedSeed = new Uint8Array(
        Array.from({ length: 32 }, (_, i) => i + 33)
      );
      const publicKey = deriveJubjubPublicKeyFromSeed(seed);
      const updatedPublicKey = deriveJubjubPublicKeyFromSeed(updatedSeed);

      simulator.addSchnorrJubjubVerificationMethod({
        id: "#key-schnorr-jubjub",
        publicKey
      });

      let ledger = simulator.getLedger();
      expect(ledger.verificationMethods.member("#key-schnorr-jubjub")).toEqual(
        false
      );
      expect(
        ledger.schnorrJubjubVerificationMethods.member("#key-schnorr-jubjub")
      ).toEqual(true);
      expect(
        ledger.schnorrJubjubVerificationMethods.lookup("#key-schnorr-jubjub")
          .publicKey
      ).toEqual(publicKey);

      expect(() =>
        simulator.addVerificationMethod({
          id: "#key-schnorr-jubjub",
          typ: VerificationMethodType.JsonWebKey,
          publicKeyJwk: {
            kty: KeyType.OKP,
            crv: CurveType.Ed25519,
            ...okpKey(123)
          }
        })
      ).toThrow(/already exists/);

      simulator.updateSchnorrJubjubVerificationMethod({
        id: "#key-schnorr-jubjub",
        publicKey: updatedPublicKey
      });
      ledger = simulator.getLedger();
      expect(
        ledger.schnorrJubjubVerificationMethods.lookup("#key-schnorr-jubjub")
          .publicKey
      ).toEqual(updatedPublicKey);

      simulator.addVerificationMethodRelation(
        VerificationMethodRelation.Authentication,
        "#key-schnorr-jubjub"
      );
      expect(() =>
        simulator.removeSchnorrJubjubVerificationMethod("#key-schnorr-jubjub")
      ).toThrow(/still referenced in authenticationRelation/);

      simulator.removeVerificationMethodRelation(
        VerificationMethodRelation.Authentication,
        "#key-schnorr-jubjub"
      );
      simulator.removeSchnorrJubjubVerificationMethod("#key-schnorr-jubjub");
      ledger = simulator.getLedger();
      expect(
        ledger.schnorrJubjubVerificationMethods.member("#key-schnorr-jubjub")
      ).toEqual(false);
    });

    it("should verify SchnorrJubjub signatures against the ledger method id", () => {
      const seed = new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1));
      const publicKey = deriveJubjubPublicKeyFromSeed(seed);
      const payload = Buffer.from("midnight-did-ledger-bound-jubjub", "utf8");
      const digest = payloadToJubjubDigest(payload);
      const signature = signJubjubPayloadFromSeed(seed, payload);

      simulator.addSchnorrJubjubVerificationMethod({
        id: "#key-schnorr-jubjub",
        publicKey
      });
      const version = simulator.getLedger().version;
      const operationCount = simulator.getLedger().operationCount;

      simulator.verifySchnorrJubjubDigestSignature(
        "#key-schnorr-jubjub",
        digest,
        signature
      );
      expect(simulator.getLedger().version).toEqual(version);
      expect(simulator.getLedger().operationCount).toEqual(operationCount);

      expect(() =>
        simulator.verifySchnorrJubjubDigestSignature(
          "#missing-key",
          digest,
          signature
        )
      ).toThrow(/Verification method does not exist/);

      expect(() =>
        simulator.verifySchnorrJubjubDigestSignature(
          "#key-schnorr-jubjub",
          payloadToJubjubDigest(Buffer.from("tampered", "utf8")),
          signature
        )
      ).toThrow(/Invalid Jubjub Schnorr signature/);
    });

    it("rejects malformed Schnorr challenge reduction witnesses", () => {
      const malformedWitnesses: typeof witnesses = {
        ...witnesses,
        getSchnorrReduction: (context, challengeHash) => {
          const [privateState, [q, r]] = witnesses.getSchnorrReduction(
            context,
            challengeHash
          );
          return [privateState, [q + 1n, r]];
        }
      };
      const simulator = new DIDSimulator();
      const badSimulator = new DIDSimulator(malformedWitnesses);
      const seed = new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1));
      const publicKey = deriveJubjubPublicKeyFromSeed(seed);
      const payload = Buffer.from("midnight-did-ledger-bound-jubjub", "utf8");
      const digest = payloadToJubjubDigest(payload);
      const signature = signJubjubPayloadFromSeed(seed, payload);

      simulator.addSchnorrJubjubVerificationMethod({
        id: "#key-schnorr-jubjub",
        publicKey
      });
      badSimulator.circuitContext = simulator.circuitContext;

      expect(() =>
        badSimulator.verifySchnorrJubjubDigestSignature(
          "#key-schnorr-jubjub",
          digest,
          signature
        )
      ).toThrow(/Invalid challenge reduction/);
    });

    it("rejects field-modulus alias Schnorr challenge reduction witnesses", () => {
      const seed = new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1));
      const publicKey = deriveJubjubPublicKeyFromSeed(seed);
      const payload = Buffer.from(
        "midnight-did-ledger-bound-jubjub:25",
        "utf8"
      );
      const digest = payloadToJubjubDigest(payload);
      const signature = signJubjubPayloadFromSeed(seed, payload);
      const challengeHash = schnorrPureCircuits.schnorrChallengeDigest(
        signature.announcement.x,
        signature.announcement.y,
        publicKey.x,
        publicKey.y,
        digest
      );
      const aliasR = challengeHash + COMPACT_FIELD_MODULUS - 116n * TWO_248;

      expect(challengeHash / TWO_248).toEqual(0n);
      expect(aliasR).toBeGreaterThanOrEqual(0n);
      expect(aliasR).toBeLessThan(TWO_248);

      const aliasWitnesses: typeof witnesses = {
        ...witnesses,
        getSchnorrReduction: ({ privateState }) => [
          privateState,
          [116n, aliasR]
        ]
      };
      const simulator = new DIDSimulator();
      const badSimulator = new DIDSimulator(aliasWitnesses);

      simulator.addSchnorrJubjubVerificationMethod({
        id: "#key-schnorr-jubjub",
        publicKey
      });
      badSimulator.circuitContext = simulator.circuitContext;

      expect(() =>
        badSimulator.verifySchnorrJubjubDigestSignature(
          "#key-schnorr-jubjub",
          digest,
          signature
        )
      ).toThrow(/Schnorr quotient out of range/);
    });

    it("should update a verification method", () => {
      // First add
      simulator.addVerificationMethod({
        id: "#key-1",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          ...okpKey(111)
        }
      });

      // Then update
      simulator.updateVerificationMethod({
        id: "#key-1",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          ...okpKey(999)
        }
      });

      const ledger = simulator.getLedger();
      const vm = ledger.verificationMethods.lookup("#key-1");
      expect(vm.publicKeyJwk.x).toEqual(keyValue(999));
      expect(vm.publicKeyJwk.y).toEqual("");
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
          ...okpKey(111)
        }
      });

      simulator.updateVerificationMethod({
        id: "#key-update-p256",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.EC,
          crv: CurveType.P256,
          ...ecKey(999, 888)
        }
      });

      const ledger = simulator.getLedger();
      const vm = ledger.verificationMethods.lookup("#key-update-p256");
      expect(vm.publicKeyJwk.kty).toEqual(KeyType.EC);
      expect(vm.publicKeyJwk.crv).toEqual(CurveType.P256);
      expect(vm.publicKeyJwk.x).toEqual(keyValue(999));
      expect(vm.publicKeyJwk.y).toEqual(keyValue(888));
    });

    it("should remove a verification method", () => {
      // First add
      simulator.addVerificationMethod({
        id: "#key-1",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          ...okpKey(111)
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
          ...okpKey(333)
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
          ...okpKey(111)
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
          ...okpKey(111)
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

    it("rejects repeated deactivation", () => {
      simulator.deactivate();

      expect(() => simulator.deactivate()).toThrow(/DID is already inactive/);
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
            ...okpKey(111)
          }
        });
      }).toThrow();
    });

    it("rejects every mutating circuit after deactivation", () => {
      const operations: Array<[string, () => void]> = [
        [
          "rotateControllerKey",
          () =>
            simulator.rotateControllerPublicKey(
              ContractExports.deriveControllerPublicKey(keyBytes(201))
            )
        ],
        [
          "setAlsoKnownAs",
          () => simulator.addAlsoKnownAs("did:example:inactive")
        ],
        [
          "setVerificationMethod",
          () =>
            simulator.addVerificationMethod({
              id: "#key-inactive",
              typ: VerificationMethodType.JsonWebKey,
              publicKeyJwk: {
                kty: KeyType.OKP,
                crv: CurveType.Ed25519,
                ...okpKey(201)
              }
            })
        ],
        [
          "removeVerificationMethod",
          () => simulator.removeVerificationMethod("#key-inactive")
        ],
        [
          "setSchnorrJubjubVerificationMethod",
          () =>
            simulator.addSchnorrJubjubVerificationMethod({
              id: "#key-schnorr-inactive",
              publicKey: deriveJubjubPublicKeyFromSeed(keyBytes(202))
            })
        ],
        [
          "removeSchnorrJubjubVerificationMethod",
          () =>
            simulator.removeSchnorrJubjubVerificationMethod(
              "#key-schnorr-inactive"
            )
        ],
        [
          "setVerificationMethodRelation",
          () =>
            simulator.addVerificationMethodRelation(
              VerificationMethodRelation.Authentication,
              "#key-inactive"
            )
        ],
        [
          "setService",
          () =>
            simulator.addService({
              id: "#service-inactive",
              typ: "MessagingService",
              serviceEndpoint: "https://example.com"
            })
        ],
        ["removeService", () => simulator.removeService("#service-inactive")]
      ];

      simulator.deactivate();

      for (const [name, operation] of operations) {
        expect(operation, name).toThrow(/Contract is not active/);
      }
    });

    it("rejects Schnorr verification when deactivated", () => {
      const seed = new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1));
      const publicKey = deriveJubjubPublicKeyFromSeed(seed);
      const payload = Buffer.from("midnight-did-inactive-jubjub", "utf8");
      const digest = payloadToJubjubDigest(payload);
      const signature = signJubjubPayloadFromSeed(seed, payload);

      simulator.addSchnorrJubjubVerificationMethod({
        id: "#key-schnorr-jubjub",
        publicKey
      });
      simulator.deactivate();
      const version = simulator.getLedger().version;
      const operationCount = simulator.getLedger().operationCount;

      expect(() =>
        simulator.verifySchnorrJubjubDigestSignature(
          "#key-schnorr-jubjub",
          digest,
          signature
        )
      ).toThrow(/Contract is not active/);
      expect(simulator.getLedger().version).toEqual(version);
      expect(simulator.getLedger().operationCount).toEqual(operationCount);
    });
  });

  describe("Mutation enum guards", () => {
    let simulator: DIDSimulator;

    beforeEach(() => {
      simulator = new DIDSimulator();
    });

    it("rejects undefined map and set mutations without changing version", () => {
      const version = simulator.getLedger().version;

      expect(() => {
        const verificationMethod = {
          id: "#key-undefined-mutation",
          typ: VerificationMethodType.JsonWebKey,
          publicKeyJwk: {
            kty: KeyType.OKP,
            crv: CurveType.Ed25519,
            ...okpKey(211)
          }
        };
        const expectedVersion = simulator.getLedger().version;
        const [signature] = simulator.controllerAuthorization(
          pureCircuits.setVerificationMethodAuthorizationDigest(
            simulator.getLedger().id,
            expectedVersion,
            verificationMethod,
            MapMutation.Undefined
          )
        );
        simulator.contract.impureCircuits.setVerificationMethod(
          simulator.circuitContext,
          verificationMethod,
          MapMutation.Undefined,
          signature,
          expectedVersion
        );
      }).toThrow(/Map mutation must be Insert or Update/);

      expect(() => {
        const expectedVersion = simulator.getLedger().version;
        const [signature] = simulator.controllerAuthorization(
          pureCircuits.setVerificationMethodRelationAuthorizationDigest(
            simulator.getLedger().id,
            expectedVersion,
            VerificationMethodRelation.Authentication,
            "#key-undefined-mutation",
            SetMutation.Undefined
          )
        );
        simulator.contract.impureCircuits.setVerificationMethodRelation(
          simulator.circuitContext,
          VerificationMethodRelation.Authentication,
          "#key-undefined-mutation",
          SetMutation.Undefined,
          signature,
          expectedVersion
        );
      }).toThrow(/Set mutation must be Insert or Remove/);

      expect(simulator.getLedger().version).toEqual(version);
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
          ...okpKey(111)
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
          ...okpKey(111)
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
