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
  it("properly initializes ledger state and private state", async () => {
    const simulator = await DIDSimulator.create();
    const initialLedgerState = simulator.getLedger();
    expect(initialLedgerState.contractVersion).toEqual(2n);
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
    expect(initialPrivateState.secretKey?.length).toEqual(32);
    expect(initialPrivateState.recoverySecretKey).toBeInstanceOf(Uint8Array);
    expect(initialPrivateState.recoverySecretKey?.length).toEqual(32);
    expect(initialLedgerState.controllerPublicKey).toEqual(
      ContractExports.deriveControllerPublicKey(initialPrivateState.secretKey!)
    );
    expect(initialLedgerState.recoveryAuthorityPublicKey).toEqual(
      ContractExports.deriveControllerPublicKey(
        initialPrivateState.recoverySecretKey!
      )
    );
  });

  it("re-exports the managed contract bundle", async () => {
    expect(ContractExports.DIDContract).toBeDefined();
  });

  it("authorizes controller updates with a wallet-local operation-bound signature", async () => {
    const simulator = await DIDSimulator.create();
    const oldSecretKey = simulator.getPrivateState().secretKey;
    const newSecretKey = keyBytes(99);
    const newControllerPublicKey =
      ContractExports.deriveControllerPublicKey(newSecretKey);

    expect(newControllerPublicKey).not.toEqual(
      ContractExports.deriveControllerPublicKey(oldSecretKey!)
    );

    await simulator.rotateControllerPublicKey(newControllerPublicKey);
    expect(simulator.getLedger().controllerPublicKey).toEqual(
      newControllerPublicKey
    );
    expect(simulator.getLedger().version).toEqual(1n);

    await expect(
      simulator.addAlsoKnownAs("did:example:old-secret")
    ).rejects.toThrow(/Invalid Jubjub Schnorr signature/);

    simulator.setPrivateState({
      ...simulator.getPrivateState(),
      secretKey: newSecretKey
    });
    await simulator.addAlsoKnownAs("did:example:new-secret");
    expect(
      simulator.getLedger().alsoKnownAs.member("did:example:new-secret")
    ).toEqual(true);
    expect(simulator.getLedger().version).toEqual(2n);
  });

  it("rejects constructor private state with matching controller and recovery authority keys", async () => {
    await expect(
      DIDSimulator.create({
        ...witnesses,
        localRecoveryAuthorityPublicKey: ({ privateState }) => [
          privateState,
          ContractExports.deriveControllerPublicKey(privateState.secretKey!)
        ]
      })
    ).rejects.toThrow(/New controller key matches recovery authority key/);
  });

  it("rejects constructor private state without a recovery authority secret", async () => {
    await expect(
      DIDSimulator.create({
        ...witnesses,
        localRecoveryAuthorityPublicKey: ({ privateState }) =>
          witnesses.localRecoveryAuthorityPublicKey({
            privateState: { secretKey: privateState.secretKey } as any
          } as any)
      })
    ).rejects.toThrow(/recovery secret key is required/);
  });

  it("recovers controller control with the recovery public key", async () => {
    const simulator = await DIDSimulator.create();
    const oldSecretKey = simulator.getPrivateState().secretKey;
    const recoveryAuthorityPublicKey =
      simulator.getLedger().recoveryAuthorityPublicKey;
    const recoveredSecretKey = keyBytes(77);
    const recoveredPublicKey =
      ContractExports.deriveControllerPublicKey(recoveredSecretKey);

    expect(recoveryAuthorityPublicKey).not.toEqual(
      simulator.getLedger().controllerPublicKey
    );

    await simulator.recoverControllerKey(recoveredSecretKey);
    expect(simulator.getLedger().controllerPublicKey).toEqual(
      recoveredPublicKey
    );
    expect(simulator.getLedger().recoveryAuthorityPublicKey).toEqual(
      recoveryAuthorityPublicKey
    );

    simulator.setPrivateState({
      ...simulator.getPrivateState(),
      secretKey: oldSecretKey
    });
    await expect(
      simulator.addAlsoKnownAs("did:example:old-controller")
    ).rejects.toThrow(/Invalid Jubjub Schnorr signature/);

    simulator.setPrivateState({
      ...simulator.getPrivateState(),
      secretKey: recoveredSecretKey
    });
    await simulator.addAlsoKnownAs("did:example:recovered-controller");
    expect(
      simulator
        .getLedger()
        .alsoKnownAs.member("did:example:recovered-controller")
    ).toEqual(true);
  });

  it("rejects controller signatures for recovery operations", async () => {
    const simulator = await DIDSimulator.create();
    const recoveredSecretKey = keyBytes(77);
    const recoveredPublicKey =
      ContractExports.deriveControllerPublicKey(recoveredSecretKey);
    const expectedVersion = simulator.getLedger().version;
    const [controllerSignature] = simulator.controllerAuthorization(
      pureCircuits.recoverControllerKeyAuthorizationDigest(
        simulator.getLedger().id,
        expectedVersion,
        recoveredPublicKey
      )
    );

    await expect(
      simulator.contract.impureCircuits.recoverControllerKey(
        simulator.circuitContext,
        recoveredPublicKey,
        controllerSignature,
        expectedVersion
      )
    ).rejects.toThrow(/Invalid Jubjub Schnorr signature/);
  });

  it("rejects recovery signatures for normal controller operations", async () => {
    const simulator = await DIDSimulator.create();
    const alias = "did:example:recovery-not-controller";
    const expectedVersion = simulator.getLedger().version;
    const [recoverySignature] = simulator.recoveryAuthorization(
      pureCircuits.setAlsoKnownAsAuthorizationDigest(
        simulator.getLedger().id,
        expectedVersion,
        alias,
        SetMutation.Insert
      )
    );

    await expect(
      simulator.contract.impureCircuits.setAlsoKnownAs(
        simulator.circuitContext,
        alias,
        SetMutation.Insert,
        recoverySignature,
        expectedVersion
      )
    ).rejects.toThrow(/Invalid Jubjub Schnorr signature/);
  });

  it("rejects stale and no-op recovery attempts", async () => {
    const simulator = await DIDSimulator.create();
    const recoveredSecretKey = keyBytes(77);
    const recoveredPublicKey =
      ContractExports.deriveControllerPublicKey(recoveredSecretKey);
    const expectedVersion = simulator.getLedger().version;
    const [signature] = simulator.recoveryAuthorization(
      pureCircuits.recoverControllerKeyAuthorizationDigest(
        simulator.getLedger().id,
        expectedVersion,
        recoveredPublicKey
      )
    );

    await simulator.addAlsoKnownAs("did:example:version-bump");
    await expect(
      simulator.contract.impureCircuits.recoverControllerKey(
        simulator.circuitContext,
        recoveredPublicKey,
        signature,
        expectedVersion
      )
    ).rejects.toThrow(/Recovery authorization version is stale/);

    const currentPublicKey = simulator.getLedger().controllerPublicKey;
    const [currentKeySignature, currentVersion] =
      simulator.recoveryAuthorization(
        pureCircuits.recoverControllerKeyAuthorizationDigest(
          simulator.getLedger().id,
          simulator.getLedger().version,
          currentPublicKey
        )
      );
    await expect(
      simulator.contract.impureCircuits.recoverControllerKey(
        simulator.circuitContext,
        currentPublicKey,
        currentKeySignature,
        currentVersion
      )
    ).rejects.toThrow(/New controller key matches current controller key/);

    const recoveryAuthorityPublicKey =
      simulator.getLedger().recoveryAuthorityPublicKey;
    const [recoveryKeySignature, recoveryKeyVersion] =
      simulator.recoveryAuthorization(
        pureCircuits.recoverControllerKeyAuthorizationDigest(
          simulator.getLedger().id,
          simulator.getLedger().version,
          recoveryAuthorityPublicKey
        )
      );
    await expect(
      simulator.contract.impureCircuits.recoverControllerKey(
        simulator.circuitContext,
        recoveryAuthorityPublicKey,
        recoveryKeySignature,
        recoveryKeyVersion
      )
    ).rejects.toThrow(/New controller key matches recovery authority key/);
  });

  it("rejects recovery after deactivation", async () => {
    const simulator = await DIDSimulator.create();
    await simulator.deactivate();

    await expect(simulator.recoverControllerKey(keyBytes(77))).rejects.toThrow(
      /Contract is not active/
    );
  });

  it("rejects controller signatures reused with different operation arguments", async () => {
    const simulator = await DIDSimulator.create();
    const [signature, expectedVersion] =
      simulator.controllerAuthorizationForAddAlsoKnownAs(
        "did:example:intended-update"
      );

    await expect(
      simulator.addAlsoKnownAsWithAuthorization(
        "did:example:tampered-update",
        signature,
        expectedVersion
      )
    ).rejects.toThrow(/Invalid Jubjub Schnorr signature/);
  });

  it("rejects controller signatures reused with a different operation", async () => {
    const simulator = await DIDSimulator.create();
    const [signature, expectedVersion] =
      simulator.controllerAuthorizationForAddAlsoKnownAs(
        "did:example:intended-update"
      );

    await expect(
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
    ).rejects.toThrow(/Invalid Jubjub Schnorr signature/);
  });

  it("rejects replayed controller authorizations after the DID version changes", async () => {
    const simulator = await DIDSimulator.create();
    const [signature, expectedVersion] =
      simulator.controllerAuthorizationForAddAlsoKnownAs(
        "did:example:replayed-update"
      );

    await simulator.addAlsoKnownAs("did:example:first-update");

    await expect(
      simulator.addAlsoKnownAsWithAuthorization(
        "did:example:replayed-update",
        signature,
        expectedVersion
      )
    ).rejects.toThrow(/Controller authorization version is stale/);
  });

  describe("Verification Methods", () => {
    let simulator: DIDSimulator;

    beforeEach(async () => {
      simulator = await DIDSimulator.create();
    });

    it("should add a verification method", async () => {
      await simulator.addVerificationMethod({
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

    it("should reject non-JsonWebKey verification methods", async () => {
      await expect(
        simulator.addVerificationMethod({
          id: "#key-1",
          typ: VerificationMethodType.Undefined,
          publicKeyJwk: {
            kty: KeyType.OKP,
            crv: CurveType.Ed25519,
            ...okpKey(12345)
          }
        })
      ).rejects.toThrow();
    });

    it("should reject unsupported key type profiles", async () => {
      await expect(
        simulator.addVerificationMethod({
          id: "#key-rsa",
          typ: VerificationMethodType.JsonWebKey,
          publicKeyJwk: {
            kty: KeyType.RSA,
            crv: CurveType.Ed25519,
            ...ecKey(12345, 67890)
          }
        })
      ).rejects.toThrow();
    });

    it("should reject unsupported key/curve combinations", async () => {
      await expect(
        simulator.addVerificationMethod({
          id: "#key-ec-invalid",
          typ: VerificationMethodType.JsonWebKey,
          publicKeyJwk: {
            kty: KeyType.EC,
            crv: CurveType.Ed25519,
            ...ecKey(12345, 67890)
          }
        })
      ).rejects.toThrow();
    });

    it("should reject Jubjub keys in the opaque verification method circuit", async () => {
      await expect(
        simulator.addVerificationMethod({
          id: "#key-jubjub-native",
          typ: VerificationMethodType.JsonWebKey,
          publicKeyJwk: {
            kty: KeyType.EC,
            crv: CurveType.Jubjub,
            ...ecKey(12345, 67890)
          }
        })
      ).rejects.toThrow(/SchnorrJubjub/);
    });

    it("should add an EC P-256 verification method", async () => {
      await simulator.addVerificationMethod({
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

    it("should add X25519 and secp256k1 verification methods", async () => {
      await simulator.addVerificationMethod({
        id: "#key-x25519",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.X25519,
          ...okpKey(10)
        }
      });
      await simulator.addVerificationMethod({
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

    it("should add BLS12-381 OKP verification methods", async () => {
      await simulator.addVerificationMethod({
        id: "#key-bls12381-g1",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.BLS12381G1,
          x: keyValueOfLength(30, 48),
          y: ""
        }
      });
      await simulator.addVerificationMethod({
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

    it("characterizes controller-authorized raw Compact opaque state reachability", async () => {
      const malformedJwk = await DIDSimulator.create();
      await malformedJwk.addVerificationMethod({
        id: "#malformed-jwk",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          x: "not-base64url!",
          y: ""
        }
      });
      expect(
        malformedJwk.getLedger().verificationMethods.member("#malformed-jwk")
      ).toEqual(true);

      const nonEmptyOkpY = await DIDSimulator.create();
      await nonEmptyOkpY.addVerificationMethod({
        id: "#non-empty-okp-y",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          x: keyValue(1),
          y: keyValue(2)
        }
      });
      expect(
        nonEmptyOkpY.getLedger().verificationMethods.lookup("#non-empty-okp-y")
          .publicKeyJwk.y
      ).toEqual(keyValue(2));

      const malformedService = await DIDSimulator.create();
      await malformedService.addService({
        id: "#malformed-service",
        typ: "",
        serviceEndpoint: "{not-json"
      });
      expect(
        malformedService.getLedger().services.member("#malformed-service")
      ).toEqual(true);

      const foreignSubject = await DIDSimulator.create();
      const foreignId = `did:midnight:testnet:${"f".repeat(64)}#key-1`;
      await foreignSubject.addVerificationMethod({
        id: foreignId,
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          ...okpKey(3)
        }
      });
      expect(
        foreignSubject.getLedger().verificationMethods.member(foreignId)
      ).toEqual(true);

      const sameStoreAliases = await DIDSimulator.create();
      for (const id of ["alias-key", "#alias-key"]) {
        await sameStoreAliases.addVerificationMethod({
          id,
          typ: VerificationMethodType.JsonWebKey,
          publicKeyJwk: {
            kty: KeyType.OKP,
            crv: CurveType.Ed25519,
            ...okpKey(id.length)
          }
        });
      }
      expect(sameStoreAliases.getLedger().verificationMethods.size()).toEqual(
        2n
      );

      const crossStoreAliases = await DIDSimulator.create();
      await crossStoreAliases.addVerificationMethod({
        id: "cross-store-key",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          ...okpKey(4)
        }
      });
      await crossStoreAliases.addSchnorrJubjubVerificationMethod({
        id: "#cross-store-key",
        publicKey: deriveJubjubPublicKeyFromSeed(keyBytes(5))
      });
      expect(
        crossStoreAliases
          .getLedger()
          .schnorrJubjubVerificationMethods.member("#cross-store-key")
      ).toEqual(true);

      const exactCrossStoreKey = await DIDSimulator.create();
      await exactCrossStoreKey.addVerificationMethod({
        id: "#exact-cross-store-key",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          ...okpKey(6)
        }
      });
      await expect(
        exactCrossStoreKey.addSchnorrJubjubVerificationMethod({
          id: "#exact-cross-store-key",
          publicKey: deriveJubjubPublicKeyFromSeed(keyBytes(7))
        })
      ).rejects.toThrow(/already exists/);
    });

    it("should add, update, relate, and remove SchnorrJubjub verification methods", async () => {
      const seed = new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1));
      const updatedSeed = new Uint8Array(
        Array.from({ length: 32 }, (_, i) => i + 33)
      );
      const publicKey = deriveJubjubPublicKeyFromSeed(seed);
      const updatedPublicKey = deriveJubjubPublicKeyFromSeed(updatedSeed);

      await simulator.addSchnorrJubjubVerificationMethod({
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

      await expect(
        simulator.addVerificationMethod({
          id: "#key-schnorr-jubjub",
          typ: VerificationMethodType.JsonWebKey,
          publicKeyJwk: {
            kty: KeyType.OKP,
            crv: CurveType.Ed25519,
            ...okpKey(123)
          }
        })
      ).rejects.toThrow(/already exists/);

      await simulator.updateSchnorrJubjubVerificationMethod({
        id: "#key-schnorr-jubjub",
        publicKey: updatedPublicKey
      });
      ledger = simulator.getLedger();
      expect(
        ledger.schnorrJubjubVerificationMethods.lookup("#key-schnorr-jubjub")
          .publicKey
      ).toEqual(updatedPublicKey);

      await simulator.addVerificationMethodRelation(
        VerificationMethodRelation.Authentication,
        "#key-schnorr-jubjub"
      );
      await expect(
        simulator.removeSchnorrJubjubVerificationMethod("#key-schnorr-jubjub")
      ).rejects.toThrow(/still referenced in authenticationRelation/);

      await simulator.removeVerificationMethodRelation(
        VerificationMethodRelation.Authentication,
        "#key-schnorr-jubjub"
      );
      await simulator.removeSchnorrJubjubVerificationMethod(
        "#key-schnorr-jubjub"
      );
      ledger = simulator.getLedger();
      expect(
        ledger.schnorrJubjubVerificationMethods.member("#key-schnorr-jubjub")
      ).toEqual(false);
    });

    it.each([
      [VerificationMethodRelation.Authentication, "authenticationRelation"],
      [VerificationMethodRelation.AssertionMethod, "assertionMethodRelation"],
      [
        VerificationMethodRelation.CapabilityInvocation,
        "capabilityInvocationRelation"
      ],
      [
        VerificationMethodRelation.CapabilityDelegation,
        "capabilityDelegationRelation"
      ]
    ])(
      "should fail to remove a SchnorrJubjub method referenced by %s",
      async (relation, ledgerRelation) => {
        await simulator.addSchnorrJubjubVerificationMethod({
          id: "#key-schnorr-referenced",
          publicKey: deriveJubjubPublicKeyFromSeed(keyBytes(44))
        });
        await simulator.addVerificationMethodRelation(
          relation,
          "#key-schnorr-referenced"
        );

        await expect(
          simulator.removeSchnorrJubjubVerificationMethod(
            "#key-schnorr-referenced"
          )
        ).rejects.toThrow(
          `Verification method still referenced in ${ledgerRelation}`
        );
      }
    );

    it("should reject using a SchnorrJubjub method for key agreement", async () => {
      await simulator.addSchnorrJubjubVerificationMethod({
        id: "#key-schnorr-agreement",
        publicKey: deriveJubjubPublicKeyFromSeed(keyBytes(45))
      });

      await expect(
        simulator.addVerificationMethodRelation(
          VerificationMethodRelation.KeyAgreement,
          "#key-schnorr-agreement"
        )
      ).rejects.toThrow(
        /KeyAgreement requires an agreement verification method/
      );
    });

    it("should verify SchnorrJubjub signatures against the ledger method id", async () => {
      const seed = new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1));
      const publicKey = deriveJubjubPublicKeyFromSeed(seed);
      const payload = Buffer.from("midnight-did-ledger-bound-jubjub", "utf8");
      const digest = payloadToJubjubDigest(payload);
      const signature = signJubjubPayloadFromSeed(seed, payload);

      await simulator.addSchnorrJubjubVerificationMethod({
        id: "#key-schnorr-jubjub",
        publicKey
      });
      const version = simulator.getLedger().version;
      const operationCount = simulator.getLedger().operationCount;

      await simulator.verifySchnorrJubjubDigestSignature(
        "#key-schnorr-jubjub",
        digest,
        signature
      );
      expect(simulator.getLedger().version).toEqual(version);
      expect(simulator.getLedger().operationCount).toEqual(operationCount);

      await expect(
        simulator.verifySchnorrJubjubDigestSignature(
          "#missing-key",
          digest,
          signature
        )
      ).rejects.toThrow(/Verification method does not exist/);

      await expect(
        simulator.verifySchnorrJubjubDigestSignature(
          "#key-schnorr-jubjub",
          payloadToJubjubDigest(Buffer.from("tampered", "utf8")),
          signature
        )
      ).rejects.toThrow(/Invalid Jubjub Schnorr signature/);
    });

    it("rejects malformed Schnorr challenge reduction witnesses", async () => {
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
      const simulator = await DIDSimulator.create();
      const badSimulator = await DIDSimulator.create(malformedWitnesses);
      const seed = new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1));
      const publicKey = deriveJubjubPublicKeyFromSeed(seed);
      const payload = Buffer.from("midnight-did-ledger-bound-jubjub", "utf8");
      const digest = payloadToJubjubDigest(payload);
      const signature = signJubjubPayloadFromSeed(seed, payload);

      await simulator.addSchnorrJubjubVerificationMethod({
        id: "#key-schnorr-jubjub",
        publicKey
      });
      badSimulator.circuitContext = simulator.circuitContext;

      await expect(
        badSimulator.verifySchnorrJubjubDigestSignature(
          "#key-schnorr-jubjub",
          digest,
          signature
        )
      ).rejects.toThrow(/Invalid challenge reduction/);
    });

    it("rejects field-modulus alias Schnorr challenge reduction witnesses", async () => {
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
      const simulator = await DIDSimulator.create();
      const badSimulator = await DIDSimulator.create(aliasWitnesses);

      await simulator.addSchnorrJubjubVerificationMethod({
        id: "#key-schnorr-jubjub",
        publicKey
      });
      badSimulator.circuitContext = simulator.circuitContext;

      await expect(
        badSimulator.verifySchnorrJubjubDigestSignature(
          "#key-schnorr-jubjub",
          digest,
          signature
        )
      ).rejects.toThrow(/Schnorr quotient out of range/);
    });

    it("should update a verification method", async () => {
      // First add
      await simulator.addVerificationMethod({
        id: "#key-1",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          ...okpKey(111)
        }
      });

      // Then update
      await simulator.updateVerificationMethod({
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

    it("should update a verification method to EC P-256", async () => {
      await simulator.addVerificationMethod({
        id: "#key-update-p256",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          ...okpKey(111)
        }
      });

      await simulator.updateVerificationMethod({
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

    it("should remove a verification method", async () => {
      // First add
      await simulator.addVerificationMethod({
        id: "#key-1",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          ...okpKey(111)
        }
      });

      // Then remove
      await simulator.removeVerificationMethod("#key-1");

      const ledger = simulator.getLedger();
      expect(ledger.verificationMethods.member("#key-1")).toEqual(false);
      expect(ledger.verificationMethods.size()).toEqual(0n);
      expect(ledger.version).toEqual(2n);
    });

    it.each([
      [
        VerificationMethodRelation.Authentication,
        CurveType.Ed25519,
        "authenticationRelation"
      ],
      [
        VerificationMethodRelation.AssertionMethod,
        CurveType.Ed25519,
        "assertionMethodRelation"
      ],
      [
        VerificationMethodRelation.KeyAgreement,
        CurveType.X25519,
        "keyAgreementRelation"
      ],
      [
        VerificationMethodRelation.CapabilityInvocation,
        CurveType.Ed25519,
        "capabilityInvocationRelation"
      ],
      [
        VerificationMethodRelation.CapabilityDelegation,
        CurveType.Ed25519,
        "capabilityDelegationRelation"
      ]
    ])(
      "should fail to remove a verification method referenced by %s",
      async (relation, curve, ledgerRelation) => {
        await simulator.addVerificationMethod({
          id: "#key-2",
          typ: VerificationMethodType.JsonWebKey,
          publicKeyJwk: {
            kty: KeyType.OKP,
            crv: curve,
            ...okpKey(333)
          }
        });
        await simulator.addVerificationMethodRelation(relation, "#key-2");

        await expect(
          simulator.removeVerificationMethod("#key-2")
        ).rejects.toThrow(
          `Verification method still referenced in ${ledgerRelation}`
        );
      }
    );

    it("should remove verification method and its relations", async () => {
      // Add verification method
      await simulator.addVerificationMethod({
        id: "#key-1",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          ...okpKey(111)
        }
      });

      // Add relations
      await simulator.addVerificationMethodRelation(
        VerificationMethodRelation.Authentication,
        "#key-1"
      );
      await simulator.addVerificationMethodRelation(
        VerificationMethodRelation.AssertionMethod,
        "#key-1"
      );

      // Verify relations exist
      let ledger = simulator.getLedger();
      expect(ledger.authenticationRelation.member("#key-1")).toEqual(true);
      expect(ledger.assertionMethodRelation.member("#key-1")).toEqual(true);

      // Remove relations first (new decomposed pattern)
      await simulator.removeVerificationMethodRelation(
        VerificationMethodRelation.Authentication,
        "#key-1"
      );
      await simulator.removeVerificationMethodRelation(
        VerificationMethodRelation.AssertionMethod,
        "#key-1"
      );

      // Then remove verification method
      await simulator.removeVerificationMethod("#key-1");

      // Verify method and relations are gone
      ledger = simulator.getLedger();
      expect(ledger.verificationMethods.member("#key-1")).toEqual(false);
      expect(ledger.authenticationRelation.member("#key-1")).toEqual(false);
      expect(ledger.assertionMethodRelation.member("#key-1")).toEqual(false);
    });
  });

  describe("Verification Method Relations", () => {
    let simulator: DIDSimulator;

    beforeEach(async () => {
      simulator = await DIDSimulator.create();
      // Add verification methods first
      await simulator.addVerificationMethod({
        id: "#key-1",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          ...okpKey(111)
        }
      });
      await simulator.addVerificationMethod({
        id: "#key-x25519",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.X25519,
          ...okpKey(112)
        }
      });
    });

    it("should add Authentication relation", async () => {
      await simulator.addVerificationMethodRelation(
        VerificationMethodRelation.Authentication,
        "#key-1"
      );

      const ledger = simulator.getLedger();
      expect(ledger.authenticationRelation.member("#key-1")).toEqual(true);
      expect(ledger.authenticationRelation.size()).toEqual(1n);
    });

    it("should add AssertionMethod relation", async () => {
      await simulator.addVerificationMethodRelation(
        VerificationMethodRelation.AssertionMethod,
        "#key-1"
      );

      const ledger = simulator.getLedger();
      expect(ledger.assertionMethodRelation.member("#key-1")).toEqual(true);
    });

    it("should add KeyAgreement relation", async () => {
      await simulator.addVerificationMethodRelation(
        VerificationMethodRelation.KeyAgreement,
        "#key-x25519"
      );

      const ledger = simulator.getLedger();
      expect(ledger.keyAgreementRelation.member("#key-x25519")).toEqual(true);
    });

    it("should reject signing keys in KeyAgreement relation", async () => {
      await expect(
        simulator.addVerificationMethodRelation(
          VerificationMethodRelation.KeyAgreement,
          "#key-1"
        )
      ).rejects.toThrow("KeyAgreement requires an X25519 verification method");
    });

    it("should reject X25519 keys in signing relations", async () => {
      await expect(
        simulator.addVerificationMethodRelation(
          VerificationMethodRelation.Authentication,
          "#key-x25519"
        )
      ).rejects.toThrow("Signing verification relations cannot use X25519");
    });

    it("should reject updates that would make existing relations incompatible", async () => {
      await simulator.addVerificationMethodRelation(
        VerificationMethodRelation.Authentication,
        "#key-1"
      );
      await expect(
        simulator.updateVerificationMethod({
          id: "#key-1",
          typ: VerificationMethodType.JsonWebKey,
          publicKeyJwk: {
            kty: KeyType.OKP,
            crv: CurveType.X25519,
            ...okpKey(113)
          }
        })
      ).rejects.toThrow(
        "Existing signing verification relations cannot use X25519"
      );

      await simulator.addVerificationMethodRelation(
        VerificationMethodRelation.KeyAgreement,
        "#key-x25519"
      );
      await expect(
        simulator.updateVerificationMethod({
          id: "#key-x25519",
          typ: VerificationMethodType.JsonWebKey,
          publicKeyJwk: {
            kty: KeyType.OKP,
            crv: CurveType.Ed25519,
            ...okpKey(114)
          }
        })
      ).rejects.toThrow("Existing KeyAgreement relation requires an X25519");
    });

    it("should add CapabilityInvocation relation", async () => {
      await simulator.addVerificationMethodRelation(
        VerificationMethodRelation.CapabilityInvocation,
        "#key-1"
      );

      const ledger = simulator.getLedger();
      expect(ledger.capabilityInvocationRelation.member("#key-1")).toEqual(
        true
      );
    });

    it("should add CapabilityDelegation relation", async () => {
      await simulator.addVerificationMethodRelation(
        VerificationMethodRelation.CapabilityDelegation,
        "#key-1"
      );

      const ledger = simulator.getLedger();
      expect(ledger.capabilityDelegationRelation.member("#key-1")).toEqual(
        true
      );
    });

    it("should remove a relation", async () => {
      // Add relation
      await simulator.addVerificationMethodRelation(
        VerificationMethodRelation.Authentication,
        "#key-1"
      );

      // Remove relation
      await simulator.removeVerificationMethodRelation(
        VerificationMethodRelation.Authentication,
        "#key-1"
      );

      const ledger = simulator.getLedger();
      expect(ledger.authenticationRelation.member("#key-1")).toEqual(false);
      expect(ledger.authenticationRelation.size()).toEqual(0n);
    });

    it("should fail when adding the same relation twice", async () => {
      await simulator.addVerificationMethodRelation(
        VerificationMethodRelation.Authentication,
        "#key-1"
      );
      await expect(
        simulator.addVerificationMethodRelation(
          VerificationMethodRelation.Authentication,
          "#key-1"
        )
      ).rejects.toThrow();
    });

    it("should fail when removing a relation that does not exist", async () => {
      await expect(
        simulator.removeVerificationMethodRelation(
          VerificationMethodRelation.Authentication,
          "#key-1"
        )
      ).rejects.toThrow();
    });
  });

  describe("Services", () => {
    let simulator: DIDSimulator;

    beforeEach(async () => {
      simulator = await DIDSimulator.create();
    });

    it("should add a service", async () => {
      await simulator.addService({
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

    it("should update a service", async () => {
      // Add service
      await simulator.addService({
        id: "#service-1",
        typ: "MessagingService",
        serviceEndpoint: "https://example.com/messages"
      });

      // Update service
      await simulator.updateService({
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

    it("should remove a service", async () => {
      // Add service
      await simulator.addService({
        id: "#service-1",
        typ: "MessagingService",
        serviceEndpoint: "https://example.com/messages"
      });

      // Remove service
      await simulator.removeService("#service-1");

      const ledger = simulator.getLedger();
      expect(ledger.services.member("#service-1")).toEqual(false);
      expect(ledger.services.size()).toEqual(0n);
    });
  });

  describe("AlsoKnownAs", () => {
    let simulator: DIDSimulator;

    beforeEach(async () => {
      simulator = await DIDSimulator.create();
    });

    it("should add an alsoKnownAs value", async () => {
      await simulator.addAlsoKnownAs("did:example:alternative-id");

      const ledger = simulator.getLedger();
      expect(ledger.alsoKnownAs.member("did:example:alternative-id")).toEqual(
        true
      );
      expect(ledger.alsoKnownAs.size()).toEqual(1n);
      expect(ledger.version).toEqual(1n);
    });

    it("should remove an alsoKnownAs value", async () => {
      // Add
      await simulator.addAlsoKnownAs("did:example:alternative-id");

      // Remove
      await simulator.removeAlsoKnownAs("did:example:alternative-id");

      const ledger = simulator.getLedger();
      expect(ledger.alsoKnownAs.member("did:example:alternative-id")).toEqual(
        false
      );
      expect(ledger.alsoKnownAs.size()).toEqual(0n);
    });

    it("should add multiple alsoKnownAs values", async () => {
      await simulator.addAlsoKnownAs("alias-1");
      await simulator.addAlsoKnownAs("alias-2");

      const ledger = simulator.getLedger();
      expect(ledger.alsoKnownAs.size()).toEqual(2n);
      expect(ledger.alsoKnownAs.member("alias-1")).toEqual(true);
      expect(ledger.alsoKnownAs.member("alias-2")).toEqual(true);
    });
  });

  describe("Deactivation", () => {
    let simulator: DIDSimulator;

    beforeEach(async () => {
      simulator = await DIDSimulator.create();
    });

    it("should deactivate the DID", async () => {
      await simulator.deactivate();

      const ledger = simulator.getLedger();
      expect(ledger.active).toEqual(false);
      expect(ledger.deactivated).toEqual(true);
      expect(ledger.version).toEqual(1n);
    });

    it("rejects repeated deactivation", async () => {
      await simulator.deactivate();

      await expect(simulator.deactivate()).rejects.toThrow(
        /DID is already inactive/
      );
    });

    it("should fail when trying to add verification method after deactivation", async () => {
      // Deactivate
      await simulator.deactivate();

      // Try to add verification method (should fail)
      await expect(
        simulator.addVerificationMethod({
          id: "#key-1",
          typ: VerificationMethodType.JsonWebKey,
          publicKeyJwk: {
            kty: KeyType.OKP,
            crv: CurveType.Ed25519,
            ...okpKey(111)
          }
        })
      ).rejects.toThrow();
    });

    it("rejects every mutating circuit after deactivation", async () => {
      const operations: Array<[string, () => Promise<void>]> = [
        [
          "rotateControllerKey",
          async () =>
            await simulator.rotateControllerPublicKey(
              ContractExports.deriveControllerPublicKey(keyBytes(201))
            )
        ],
        [
          "setAlsoKnownAs",
          async () => await simulator.addAlsoKnownAs("did:example:inactive")
        ],
        [
          "setVerificationMethod",
          async () =>
            await simulator.addVerificationMethod({
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
          async () => await simulator.removeVerificationMethod("#key-inactive")
        ],
        [
          "setSchnorrJubjubVerificationMethod",
          async () =>
            await simulator.addSchnorrJubjubVerificationMethod({
              id: "#key-schnorr-inactive",
              publicKey: deriveJubjubPublicKeyFromSeed(keyBytes(202))
            })
        ],
        [
          "removeSchnorrJubjubVerificationMethod",
          async () =>
            await simulator.removeSchnorrJubjubVerificationMethod(
              "#key-schnorr-inactive"
            )
        ],
        [
          "setVerificationMethodRelation",
          async () =>
            await simulator.addVerificationMethodRelation(
              VerificationMethodRelation.Authentication,
              "#key-inactive"
            )
        ],
        [
          "setService",
          async () =>
            await simulator.addService({
              id: "#service-inactive",
              typ: "MessagingService",
              serviceEndpoint: "https://example.com"
            })
        ],
        [
          "removeService",
          async () => await simulator.removeService("#service-inactive")
        ]
      ];

      await simulator.deactivate();

      for (const [name, operation] of operations) {
        await expect(operation(), name).rejects.toThrow(
          /Contract is not active/
        );
      }
    });

    it("rejects Schnorr verification when deactivated", async () => {
      const seed = new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1));
      const publicKey = deriveJubjubPublicKeyFromSeed(seed);
      const payload = Buffer.from("midnight-did-inactive-jubjub", "utf8");
      const digest = payloadToJubjubDigest(payload);
      const signature = signJubjubPayloadFromSeed(seed, payload);

      await simulator.addSchnorrJubjubVerificationMethod({
        id: "#key-schnorr-jubjub",
        publicKey
      });
      await simulator.deactivate();
      const version = simulator.getLedger().version;
      const operationCount = simulator.getLedger().operationCount;

      await expect(
        simulator.verifySchnorrJubjubDigestSignature(
          "#key-schnorr-jubjub",
          digest,
          signature
        )
      ).rejects.toThrow(/Contract is not active/);
      expect(simulator.getLedger().version).toEqual(version);
      expect(simulator.getLedger().operationCount).toEqual(operationCount);
    });
  });

  describe("Mutation enum guards", () => {
    let simulator: DIDSimulator;

    beforeEach(async () => {
      simulator = await DIDSimulator.create();
    });

    it("rejects undefined map and set mutations without changing version", async () => {
      const version = simulator.getLedger().version;

      await expect(async () => {
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
        await simulator.contract.impureCircuits.setVerificationMethod(
          simulator.circuitContext,
          verificationMethod,
          MapMutation.Undefined,
          signature,
          expectedVersion
        );
      }).rejects.toThrow(/Map mutation must be Insert or Update/);

      await expect(async () => {
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
        await simulator.contract.impureCircuits.setVerificationMethodRelation(
          simulator.circuitContext,
          VerificationMethodRelation.Authentication,
          "#key-undefined-mutation",
          SetMutation.Undefined,
          signature,
          expectedVersion
        );
      }).rejects.toThrow(/Set mutation must be Insert or Remove/);

      expect(simulator.getLedger().version).toEqual(version);
    });
  });

  describe("Multiple Operations", () => {
    let simulator: DIDSimulator;

    beforeEach(async () => {
      simulator = await DIDSimulator.create();
    });

    it("should apply multiple operations sequentially", async () => {
      await simulator.addVerificationMethod({
        id: "#key-1",
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          ...okpKey(111)
        }
      });
      await simulator.addVerificationMethodRelation(
        VerificationMethodRelation.Authentication,
        "#key-1"
      );
      await simulator.addService({
        id: "#service-1",
        typ: "MessagingService",
        serviceEndpoint: "https://example.com"
      });
      await simulator.addAlsoKnownAs("did:example:alias");

      const ledger = simulator.getLedger();
      expect(ledger.verificationMethods.member("#key-1")).toEqual(true);
      expect(ledger.authenticationRelation.member("#key-1")).toEqual(true);
      expect(ledger.services.member("#service-1")).toEqual(true);
      expect(ledger.alsoKnownAs.member("did:example:alias")).toEqual(true);
      expect(ledger.version).toEqual(4n);
      expect(ledger.operationCount).toEqual(4n);
    });

    it("should handle version counter correctly across multiple transactions", async () => {
      // Transaction 1
      await simulator.addVerificationMethod({
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
      await simulator.addService({
        id: "#service-1",
        typ: "Test",
        serviceEndpoint: "https://test.com"
      });

      expect(simulator.getLedger().version).toEqual(2n);

      // Transaction 3
      await simulator.addAlsoKnownAs("alias-1");
      await simulator.addAlsoKnownAs("alias-2");

      const ledger = simulator.getLedger();
      expect(ledger.version).toEqual(4n);
      expect(ledger.operationCount).toEqual(4n);
    });
  });
});
