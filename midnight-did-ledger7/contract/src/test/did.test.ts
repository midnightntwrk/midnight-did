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

import { DIDSimulator } from "./did-simulator.js";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect, beforeEach } from "vitest";
import { VerificationMethodType, VerificationMethodRelation, KeyType, CurveType } from "../managed/did/contract/index.js";

setNetworkId("undeployed");

describe("DID smart contract", () => {
  it("properly initializes ledger state and private state", () => {
    const simulator = new DIDSimulator();
    const initialLedgerState = simulator.getLedger();
    expect(initialLedgerState.contractVersion).toEqual(1n);
    expect(initialLedgerState.active).toEqual(true);
    expect(initialLedgerState.created).toEqual(0n);
    expect(initialLedgerState.updated).toEqual(0n);
    expect(initialLedgerState.deactivated).toEqual(false);
    expect(initialLedgerState.version).toEqual(0n);
    expect(initialLedgerState.operationCount).toEqual(0n);
    const initialPrivateState = simulator.getPrivateState();
    expect(initialPrivateState).toEqual({});
  });

  describe("Verification Methods", () => {
    let simulator: DIDSimulator;

    beforeEach(() => {
      simulator = new DIDSimulator();
    });

    it("should add a verification method", () => {
      simulator.addVerificationMethod({
        id: '#key-1',
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: {
          kty: KeyType.OKP,
          crv: CurveType.Ed25519,
          x: 12345n,
          y: 67890n,
        },
      });

      const ledger = simulator.getLedger();
      expect(ledger.verificationMethods.member('#key-1')).toEqual(true);
      expect(ledger.verificationMethods.size()).toEqual(1n);
      expect(ledger.version).toEqual(1n);
      expect(ledger.operationCount).toEqual(1n);

      const vm = ledger.verificationMethods.lookup('#key-1');
      expect(vm.id).toEqual('#key-1');
      expect(vm.typ).toEqual(VerificationMethodType.JsonWebKey);
      expect(vm.publicKeyJwk.kty).toEqual(KeyType.OKP);
      expect(vm.publicKeyJwk.crv).toEqual(CurveType.Ed25519);
      expect(vm.publicKeyJwk.x).toEqual(12345n);
      expect(vm.publicKeyJwk.y).toEqual(67890n);
    });

    it("should update a verification method", () => {
      // First add
      simulator.addVerificationMethod({
        id: '#key-1',
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: { kty: KeyType.OKP, crv: CurveType.Ed25519, x: 111n, y: 222n },
      });

      // Then update
      simulator.updateVerificationMethod({
        id: '#key-1',
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: { kty: KeyType.OKP, crv: CurveType.Ed25519, x: 999n, y: 888n },
      });

      const ledger = simulator.getLedger();
      const vm = ledger.verificationMethods.lookup('#key-1');
      expect(vm.publicKeyJwk.x).toEqual(999n);
      expect(vm.publicKeyJwk.y).toEqual(888n);
      expect(ledger.version).toEqual(2n);
      expect(ledger.operationCount).toEqual(2n);
    });

    it("should remove a verification method", () => {
      // First add
      simulator.addVerificationMethod({
        id: '#key-1',
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: { kty: KeyType.OKP, crv: CurveType.Ed25519, x: 111n, y: 222n },
      });

      // Then remove
      simulator.removeVerificationMethod('#key-1');

      const ledger = simulator.getLedger();
      expect(ledger.verificationMethods.member('#key-1')).toEqual(false);
      expect(ledger.verificationMethods.size()).toEqual(0n);
      expect(ledger.version).toEqual(2n);
    });

    it("should remove verification method and its relations", () => {
      // Add verification method
      simulator.addVerificationMethod({
        id: '#key-1',
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: { kty: KeyType.OKP, crv: CurveType.Ed25519, x: 111n, y: 222n },
      });

      // Add relations
      simulator.addVerificationMethodRelation(VerificationMethodRelation.Authentication, '#key-1');
      simulator.addVerificationMethodRelation(VerificationMethodRelation.AssertionMethod, '#key-1');

      // Verify relations exist
      let ledger = simulator.getLedger();
      expect(ledger.authenticationRelation.member('#key-1')).toEqual(true);
      expect(ledger.assertionMethodRelation.member('#key-1')).toEqual(true);

      // Remove verification method
      simulator.removeVerificationMethod('#key-1');

      // Verify method and relations are gone
      ledger = simulator.getLedger();
      expect(ledger.verificationMethods.member('#key-1')).toEqual(false);
      expect(ledger.authenticationRelation.member('#key-1')).toEqual(false);
      expect(ledger.assertionMethodRelation.member('#key-1')).toEqual(false);
    });
  });

  describe("Verification Method Relations", () => {
    let simulator: DIDSimulator;

    beforeEach(() => {
      simulator = new DIDSimulator();
      // Add a verification method first
      simulator.addVerificationMethod({
        id: '#key-1',
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: { kty: KeyType.OKP, crv: CurveType.Ed25519, x: 111n, y: 222n },
      });
    });

    it("should add Authentication relation", () => {
      simulator.addVerificationMethodRelation(VerificationMethodRelation.Authentication, '#key-1');

      const ledger = simulator.getLedger();
      expect(ledger.authenticationRelation.member('#key-1')).toEqual(true);
      expect(ledger.authenticationRelation.size()).toEqual(1n);
    });

    it("should add AssertionMethod relation", () => {
      simulator.addVerificationMethodRelation(VerificationMethodRelation.AssertionMethod, '#key-1');

      const ledger = simulator.getLedger();
      expect(ledger.assertionMethodRelation.member('#key-1')).toEqual(true);
    });

    it("should add KeyAgreement relation", () => {
      simulator.addVerificationMethodRelation(VerificationMethodRelation.KeyAgreement, '#key-1');

      const ledger = simulator.getLedger();
      expect(ledger.keyAgreementRelation.member('#key-1')).toEqual(true);
    });

    it("should add CapabilityInvocation relation", () => {
      simulator.addVerificationMethodRelation(VerificationMethodRelation.CapabilityInvocation, '#key-1');

      const ledger = simulator.getLedger();
      expect(ledger.capabilityInvocationRelation.member('#key-1')).toEqual(true);
    });

    it("should add CapabilityDelegation relation", () => {
      simulator.addVerificationMethodRelation(VerificationMethodRelation.CapabilityDelegation, '#key-1');

      const ledger = simulator.getLedger();
      expect(ledger.capabilityDelegationRelation.member('#key-1')).toEqual(true);
    });

    it("should remove a relation", () => {
      // Add relation
      simulator.addVerificationMethodRelation(VerificationMethodRelation.Authentication, '#key-1');

      // Remove relation
      simulator.removeVerificationMethodRelation(VerificationMethodRelation.Authentication, '#key-1');

      const ledger = simulator.getLedger();
      expect(ledger.authenticationRelation.member('#key-1')).toEqual(false);
      expect(ledger.authenticationRelation.size()).toEqual(0n);
    });
  });

  describe("Services", () => {
    let simulator: DIDSimulator;

    beforeEach(() => {
      simulator = new DIDSimulator();
    });

    it("should add a service", () => {
      simulator.addService({
        id: '#service-1',
        typ: 'MessagingService',
        serviceEndpoint: 'https://example.com/messages',
      });

      const ledger = simulator.getLedger();
      expect(ledger.services.member('#service-1')).toEqual(true);
      expect(ledger.services.size()).toEqual(1n);

      const service = ledger.services.lookup('#service-1');
      expect(service.id).toEqual('#service-1');
      expect(service.typ).toEqual('MessagingService');
      expect(service.serviceEndpoint).toEqual('https://example.com/messages');
    });

    it("should update a service", () => {
      // Add service
      simulator.addService({
        id: '#service-1',
        typ: 'MessagingService',
        serviceEndpoint: 'https://example.com/messages',
      });

      // Update service
      simulator.updateService({
        id: '#service-1',
        typ: 'MessagingService',
        serviceEndpoint: 'https://new-endpoint.com/messages',
      });

      const ledger = simulator.getLedger();
      const service = ledger.services.lookup('#service-1');
      expect(service.serviceEndpoint).toEqual('https://new-endpoint.com/messages');
      expect(ledger.version).toEqual(2n);
    });

    it("should remove a service", () => {
      // Add service
      simulator.addService({
        id: '#service-1',
        typ: 'MessagingService',
        serviceEndpoint: 'https://example.com/messages',
      });

      // Remove service
      simulator.removeService('#service-1');

      const ledger = simulator.getLedger();
      expect(ledger.services.member('#service-1')).toEqual(false);
      expect(ledger.services.size()).toEqual(0n);
    });
  });

  describe("AlsoKnownAs", () => {
    let simulator: DIDSimulator;

    beforeEach(() => {
      simulator = new DIDSimulator();
    });

    it("should add an alsoKnownAs value", () => {
      simulator.addAlsoKnownAs('did:example:alternative-id');

      const ledger = simulator.getLedger();
      expect(ledger.alsoKnownAs.member('did:example:alternative-id')).toEqual(true);
      expect(ledger.alsoKnownAs.size()).toEqual(1n);
      expect(ledger.version).toEqual(1n);
    });

    it("should remove an alsoKnownAs value", () => {
      // Add
      simulator.addAlsoKnownAs('did:example:alternative-id');

      // Remove
      simulator.removeAlsoKnownAs('did:example:alternative-id');

      const ledger = simulator.getLedger();
      expect(ledger.alsoKnownAs.member('did:example:alternative-id')).toEqual(false);
      expect(ledger.alsoKnownAs.size()).toEqual(0n);
    });

    it("should add multiple alsoKnownAs values", () => {
      simulator.addAlsoKnownAs('alias-1');
      simulator.addAlsoKnownAs('alias-2');

      const ledger = simulator.getLedger();
      expect(ledger.alsoKnownAs.size()).toEqual(2n);
      expect(ledger.alsoKnownAs.member('alias-1')).toEqual(true);
      expect(ledger.alsoKnownAs.member('alias-2')).toEqual(true);
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
          id: '#key-1',
          typ: VerificationMethodType.JsonWebKey,
          publicKeyJwk: { kty: KeyType.OKP, crv: CurveType.Ed25519, x: 111n, y: 222n },
        });
      }).toThrow();
    });
  });

  describe("Batch Operations", () => {
    let simulator: DIDSimulator;

    beforeEach(() => {
      simulator = new DIDSimulator();
    });

    it("should apply multiple operations in one transaction", () => {
      simulator.addVerificationMethod({
        id: '#key-1',
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: { kty: KeyType.OKP, crv: CurveType.Ed25519, x: 111n, y: 222n },
      });
      simulator.addVerificationMethodRelation(VerificationMethodRelation.Authentication, '#key-1');
      simulator.addService({
        id: '#service-1',
        typ: 'MessagingService',
        serviceEndpoint: 'https://example.com',
      });
      simulator.addAlsoKnownAs('did:example:alias');

      const ledger = simulator.getLedger();
      expect(ledger.verificationMethods.member('#key-1')).toEqual(true);
      expect(ledger.authenticationRelation.member('#key-1')).toEqual(true);
      expect(ledger.services.member('#service-1')).toEqual(true);
      expect(ledger.alsoKnownAs.member('did:example:alias')).toEqual(true);
      expect(ledger.version).toEqual(4n);
      expect(ledger.operationCount).toEqual(4n);
    });

    it("should handle version counter correctly across multiple transactions", () => {
      // Transaction 1
      simulator.addVerificationMethod({
        id: '#key-1',
        typ: VerificationMethodType.JsonWebKey,
        publicKeyJwk: { kty: KeyType.OKP, crv: CurveType.Ed25519, x: 111n, y: 222n },
      });

      expect(simulator.getLedger().version).toEqual(1n);

      // Transaction 2
      simulator.addService({ id: '#service-1', typ: 'Test', serviceEndpoint: 'https://test.com' });

      expect(simulator.getLedger().version).toEqual(2n);

      // Transaction 3
      simulator.addAlsoKnownAs('alias-1');
      simulator.addAlsoKnownAs('alias-2');

      const ledger = simulator.getLedger();
      expect(ledger.version).toEqual(4n);
      expect(ledger.operationCount).toEqual(4n);
    });
  });
});
