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
import { OperationType, VerificationMethodType, VerificationMethodRelation, KeyType, CurveType } from "../managed/did/contract/index.js";

setNetworkId("undeployed");

// Helper to create a complete DIDUpdateOperation with all required fields
// Compact requires all fields to be present even if not used for the specific operation
const createCompleteOperation = (partial: any): any => {
  const emptyVm = { id: '', typ: VerificationMethodType.Undefined, publicKeyJwk: { kty: KeyType.EC, crv: CurveType.Ed25519, x: 0n, y: 0n } };
  const emptyService = { id: '', typ: '', serviceEndpoint: '' };

  return {
    operationType: partial.operationType ?? OperationType.Undefined,
    addVerificationMethodOptions: partial.addVerificationMethodOptions ?? { verificationMethod: emptyVm },
    updateVerificationMethodOptions: partial.updateVerificationMethodOptions ?? { verificationMethod: emptyVm },
    removeVerificationMethodOptions: partial.removeVerificationMethodOptions ?? { id: '' },
    addVerificationMethodRelationOptions: partial.addVerificationMethodRelationOptions ?? { relation: VerificationMethodRelation.Undefined, methodId: '' },
    removeVerificationMethodRelationOptions: partial.removeVerificationMethodRelationOptions ?? { relation: VerificationMethodRelation.Undefined, methodId: '' },
    addServiceOptions: partial.addServiceOptions ?? { service: emptyService },
    updateServiceOptions: partial.updateServiceOptions ?? { service: emptyService },
    removeServiceOptions: partial.removeServiceOptions ?? { id: '' },
    addAlsoKnownAsOptions: partial.addAlsoKnownAsOptions ?? { value: '' },
    removeAlsoKnownAsOptions: partial.removeAlsoKnownAsOptions ?? { value: '' },
  };
};

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
      const operation = createCompleteOperation({
        operationType: OperationType.AddVerificationMethod,
        addVerificationMethodOptions: {
          verificationMethod: {
            id: '#key-1',
            typ: VerificationMethodType.JsonWebKey,
            publicKeyJwk: {
              kty: KeyType.OKP,
              crv: CurveType.Ed25519,
              x: 12345n,
              y: 67890n,
            },
          },
        },
      });

      simulator.applyOperations([operation]);

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
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.AddVerificationMethod,
        addVerificationMethodOptions: {
          verificationMethod: {
            id: '#key-1',
            typ: VerificationMethodType.JsonWebKey,
            publicKeyJwk: { kty: KeyType.OKP, crv: CurveType.Ed25519, x: 111n, y: 222n },
          },
        },
      })]);

      // Then update
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.UpdateVerificationMethod,
        updateVerificationMethodOptions: {
          verificationMethod: {
            id: '#key-1',
            typ: VerificationMethodType.JsonWebKey,
            publicKeyJwk: { kty: KeyType.OKP, crv: CurveType.Ed25519, x: 999n, y: 888n },
          },
        },
      })]);

      const ledger = simulator.getLedger();
      const vm = ledger.verificationMethods.lookup('#key-1');
      expect(vm.publicKeyJwk.x).toEqual(999n);
      expect(vm.publicKeyJwk.y).toEqual(888n);
      expect(ledger.version).toEqual(2n);
      expect(ledger.operationCount).toEqual(2n);
    });

    it("should remove a verification method", () => {
      // First add
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.AddVerificationMethod,
        addVerificationMethodOptions: {
          verificationMethod: {
            id: '#key-1',
            typ: VerificationMethodType.JsonWebKey,
            publicKeyJwk: { kty: KeyType.OKP, crv: CurveType.Ed25519, x: 111n, y: 222n },
          },
        },
      })]);

      // Then remove
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.RemoveVerificationMethod,
        removeVerificationMethodOptions: { id: '#key-1' },
      })]);

      const ledger = simulator.getLedger();
      expect(ledger.verificationMethods.member('#key-1')).toEqual(false);
      expect(ledger.verificationMethods.size()).toEqual(0n);
      expect(ledger.version).toEqual(2n);
    });

    it("should remove verification method and its relations", () => {
      // Add verification method
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.AddVerificationMethod,
        addVerificationMethodOptions: {
          verificationMethod: {
            id: '#key-1',
            typ: VerificationMethodType.JsonWebKey,
            publicKeyJwk: { kty: KeyType.OKP, crv: CurveType.Ed25519, x: 111n, y: 222n },
          },
        },
      })]);

      // Add relations
      simulator.applyOperations([
        createCompleteOperation({
          operationType: OperationType.AddVerificationMethodRelation,
          addVerificationMethodRelationOptions: {
            relation: VerificationMethodRelation.Authentication,
            methodId: '#key-1',
          },
        }),
        createCompleteOperation({
          operationType: OperationType.AddVerificationMethodRelation,
          addVerificationMethodRelationOptions: {
            relation: VerificationMethodRelation.AssertionMethod,
            methodId: '#key-1',
          },
        }),
      ]);

      // Verify relations exist
      let ledger = simulator.getLedger();
      expect(ledger.authenticationRelation.member('#key-1')).toEqual(true);
      expect(ledger.assertionMethodRelation.member('#key-1')).toEqual(true);

      // Remove verification method
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.RemoveVerificationMethod,
        removeVerificationMethodOptions: { id: '#key-1' },
      })]);

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
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.AddVerificationMethod,
        addVerificationMethodOptions: {
          verificationMethod: {
            id: '#key-1',
            typ: VerificationMethodType.JsonWebKey,
            publicKeyJwk: { kty: KeyType.OKP, crv: CurveType.Ed25519, x: 111n, y: 222n },
          },
        },
      })]);
    });

    it("should add Authentication relation", () => {
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.AddVerificationMethodRelation,
        addVerificationMethodRelationOptions: {
          relation: VerificationMethodRelation.Authentication,
          methodId: '#key-1',
        },
      })]);

      const ledger = simulator.getLedger();
      expect(ledger.authenticationRelation.member('#key-1')).toEqual(true);
      expect(ledger.authenticationRelation.size()).toEqual(1n);
    });

    it("should add AssertionMethod relation", () => {
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.AddVerificationMethodRelation,
        addVerificationMethodRelationOptions: {
          relation: VerificationMethodRelation.AssertionMethod,
          methodId: '#key-1',
        },
      })]);

      const ledger = simulator.getLedger();
      expect(ledger.assertionMethodRelation.member('#key-1')).toEqual(true);
    });

    it("should add KeyAgreement relation", () => {
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.AddVerificationMethodRelation,
        addVerificationMethodRelationOptions: {
          relation: VerificationMethodRelation.KeyAgreement,
          methodId: '#key-1',
        },
      })]);

      const ledger = simulator.getLedger();
      expect(ledger.keyAgreementRelation.member('#key-1')).toEqual(true);
    });

    it("should add CapabilityInvocation relation", () => {
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.AddVerificationMethodRelation,
        addVerificationMethodRelationOptions: {
          relation: VerificationMethodRelation.CapabilityInvocation,
          methodId: '#key-1',
        },
      })]);

      const ledger = simulator.getLedger();
      expect(ledger.capabilityInvocationRelation.member('#key-1')).toEqual(true);
    });

    it("should add CapabilityDelegation relation", () => {
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.AddVerificationMethodRelation,
        addVerificationMethodRelationOptions: {
          relation: VerificationMethodRelation.CapabilityDelegation,
          methodId: '#key-1',
        },
      })]);

      const ledger = simulator.getLedger();
      expect(ledger.capabilityDelegationRelation.member('#key-1')).toEqual(true);
    });

    it("should remove a relation", () => {
      // Add relation
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.AddVerificationMethodRelation,
        addVerificationMethodRelationOptions: {
          relation: VerificationMethodRelation.Authentication,
          methodId: '#key-1',
        },
      })]);

      // Remove relation
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.RemoveVerificationMethodRelation,
        removeVerificationMethodRelationOptions: {
          relation: VerificationMethodRelation.Authentication,
          methodId: '#key-1',
        },
      })]);

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
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.AddService,
        addServiceOptions: {
          service: {
            id: '#service-1',
            typ: 'MessagingService',
            serviceEndpoint: 'https://example.com/messages',
          },
        },
      })]);

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
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.AddService,
        addServiceOptions: {
          service: {
            id: '#service-1',
            typ: 'MessagingService',
            serviceEndpoint: 'https://example.com/messages',
          },
        },
      })]);

      // Update service
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.UpdateService,
        updateServiceOptions: {
          service: {
            id: '#service-1',
            typ: 'MessagingService',
            serviceEndpoint: 'https://new-endpoint.com/messages',
          },
        },
      })]);

      const ledger = simulator.getLedger();
      const service = ledger.services.lookup('#service-1');
      expect(service.serviceEndpoint).toEqual('https://new-endpoint.com/messages');
      expect(ledger.version).toEqual(2n);
    });

    it("should remove a service", () => {
      // Add service
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.AddService,
        addServiceOptions: {
          service: {
            id: '#service-1',
            typ: 'MessagingService',
            serviceEndpoint: 'https://example.com/messages',
          },
        },
      })]);

      // Remove service
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.RemoveService,
        removeServiceOptions: { id: '#service-1' },
      })]);

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
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.AddAlsoKnownAs,
        addAlsoKnownAsOptions: { value: 'did:example:alternative-id' },
      })]);

      const ledger = simulator.getLedger();
      expect(ledger.alsoKnownAs.member('did:example:alternative-id')).toEqual(true);
      expect(ledger.alsoKnownAs.size()).toEqual(1n);
      expect(ledger.version).toEqual(1n);
    });

    it("should remove an alsoKnownAs value", () => {
      // Add
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.AddAlsoKnownAs,
        addAlsoKnownAsOptions: { value: 'did:example:alternative-id' },
      })]);

      // Remove
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.RemoveAlsoKnownAs,
        removeAlsoKnownAsOptions: { value: 'did:example:alternative-id' },
      })]);

      const ledger = simulator.getLedger();
      expect(ledger.alsoKnownAs.member('did:example:alternative-id')).toEqual(false);
      expect(ledger.alsoKnownAs.size()).toEqual(0n);
    });

    it("should add multiple alsoKnownAs values", () => {
      simulator.applyOperations([
        createCompleteOperation({ operationType: OperationType.AddAlsoKnownAs, addAlsoKnownAsOptions: { value: 'alias-1' } }),
        createCompleteOperation({ operationType: OperationType.AddAlsoKnownAs, addAlsoKnownAsOptions: { value: 'alias-2' } }),
      ]);

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
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.Deactivate,
      })]);

      const ledger = simulator.getLedger();
      expect(ledger.active).toEqual(false);
      expect(ledger.deactivated).toEqual(true);
      expect(ledger.version).toEqual(1n);
    });

    it("should fail when trying to add verification method after deactivation", () => {
      // Deactivate
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.Deactivate,
      })]);

      // Try to add verification method (should fail)
      expect(() => {
        simulator.applyOperations([createCompleteOperation({
          operationType: OperationType.AddVerificationMethod,
          addVerificationMethodOptions: {
            verificationMethod: {
              id: '#key-1',
              typ: VerificationMethodType.JsonWebKey,
              publicKeyJwk: { kty: KeyType.OKP, crv: CurveType.Ed25519, x: 111n, y: 222n },
            },
          },
        })]);
      }).toThrow();
    });
  });

  describe("Batch Operations", () => {
    let simulator: DIDSimulator;

    beforeEach(() => {
      simulator = new DIDSimulator();
    });

    it("should apply multiple operations in one transaction", () => {
      simulator.applyOperations([
        createCompleteOperation({
          operationType: OperationType.AddVerificationMethod,
          addVerificationMethodOptions: {
            verificationMethod: {
              id: '#key-1',
              typ: VerificationMethodType.JsonWebKey,
              publicKeyJwk: { kty: KeyType.OKP, crv: CurveType.Ed25519, x: 111n, y: 222n },
            },
          },
        }),
        createCompleteOperation({
          operationType: OperationType.AddVerificationMethodRelation,
          addVerificationMethodRelationOptions: {
            relation: VerificationMethodRelation.Authentication,
            methodId: '#key-1',
          },
        }),
        createCompleteOperation({
          operationType: OperationType.AddService,
          addServiceOptions: {
            service: {
              id: '#service-1',
              typ: 'MessagingService',
              serviceEndpoint: 'https://example.com',
            },
          },
        }),
        createCompleteOperation({
          operationType: OperationType.AddAlsoKnownAs,
          addAlsoKnownAsOptions: { value: 'did:example:alias' },
        }),
      ]);

      const ledger = simulator.getLedger();
      expect(ledger.verificationMethods.member('#key-1')).toEqual(true);
      expect(ledger.authenticationRelation.member('#key-1')).toEqual(true);
      expect(ledger.services.member('#service-1')).toEqual(true);
      expect(ledger.alsoKnownAs.member('did:example:alias')).toEqual(true);
      expect(ledger.version).toEqual(1n); // All in one transaction
      expect(ledger.operationCount).toEqual(4n);
    });

    it("should handle version counter correctly across multiple transactions", () => {
      // Transaction 1
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.AddVerificationMethod,
        addVerificationMethodOptions: {
          verificationMethod: {
            id: '#key-1',
            typ: VerificationMethodType.JsonWebKey,
            publicKeyJwk: { kty: KeyType.OKP, crv: CurveType.Ed25519, x: 111n, y: 222n },
          },
        },
      })]);

      expect(simulator.getLedger().version).toEqual(1n);

      // Transaction 2
      simulator.applyOperations([createCompleteOperation({
        operationType: OperationType.AddService,
        addServiceOptions: {
          service: { id: '#service-1', typ: 'Test', serviceEndpoint: 'https://test.com' },
        },
      })]);

      expect(simulator.getLedger().version).toEqual(2n);

      // Transaction 3 (batch)
      simulator.applyOperations([
        createCompleteOperation({ operationType: OperationType.AddAlsoKnownAs, addAlsoKnownAsOptions: { value: 'alias-1' } }),
        createCompleteOperation({ operationType: OperationType.AddAlsoKnownAs, addAlsoKnownAsOptions: { value: 'alias-2' } }),
      ]);

      const ledger = simulator.getLedger();
      expect(ledger.version).toEqual(3n);
      expect(ledger.operationCount).toEqual(4n);
    });
  });
});
