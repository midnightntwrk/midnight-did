import { DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import {
  CurveType,
  VerificationMethodRelationType,
} from "@midnight-ntwrk/midnight-did-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("../controller-authorization.js", () => ({
  createControllerAuthorization: vi.fn(async () => [
    { announcement: { x: 1n, y: 2n }, response: 3n },
    7n,
  ]),
}));

import { VerificationMethodReferencedError } from "../verification-method-errors.js";
import {
  assertExistingVerificationMethodRelationsCompatible,
  assertVerificationMethodIsNotReferenced,
  assertVerificationMethodRelationAbsent,
  assertVerificationMethodRelationCompatible,
  assertVerificationMethodRelationPresent,
  verificationMethodRelationMemberships,
  VerificationMethodRelations,
} from "../verification-method-relations.js";

type LedgerRelationSets = {
  readonly authentication?: readonly string[];
  readonly assertionMethod?: readonly string[];
  readonly keyAgreement?: readonly string[];
  readonly capabilityInvocation?: readonly string[];
  readonly capabilityDelegation?: readonly string[];
  readonly verificationMethods?: ReadonlyMap<string, DIDContract.CurveType>;
  readonly schnorrJubjubVerificationMethods?: readonly string[];
};

const relationSet = (members: readonly string[]) => ({
  member: vi.fn((value: string) => members.includes(value)),
});

const methodMap = (
  entries: ReadonlyMap<string, DIDContract.CurveType> = new Map(),
) => ({
  member: vi.fn((value: string) => entries.has(value)),
  lookup: vi.fn((value: string) => ({
    publicKeyJwk: { crv: entries.get(value) },
  })),
});

const ledgerState = ({
  authentication = [],
  assertionMethod = [],
  keyAgreement = [],
  capabilityInvocation = [],
  capabilityDelegation = [],
  verificationMethods = new Map(),
  schnorrJubjubVerificationMethods = [],
}: LedgerRelationSets = {}): DIDContract.Ledger =>
  ({
    authenticationRelation: relationSet(authentication),
    assertionMethodRelation: relationSet(assertionMethod),
    keyAgreementRelation: relationSet(keyAgreement),
    capabilityInvocationRelation: relationSet(capabilityInvocation),
    capabilityDelegationRelation: relationSet(capabilityDelegation),
    verificationMethods: methodMap(verificationMethods),
    schnorrJubjubVerificationMethods: relationSet(
      schnorrJubjubVerificationMethods,
    ),
  }) as unknown as DIDContract.Ledger;
describe("verification method relation operations", () => {
  it("reports membership for every defined verification method relation", () => {
    const state = ledgerState({
      authentication: ["#key-1"],
      keyAgreement: ["#key-1"],
      capabilityDelegation: ["#key-2"],
    });

    expect(verificationMethodRelationMemberships(state, "#key-1")).toEqual([
      {
        relation: VerificationMethodRelationType.Authentication,
        member: true,
      },
      {
        relation: VerificationMethodRelationType.AssertionMethod,
        member: false,
      },
      {
        relation: VerificationMethodRelationType.KeyAgreement,
        member: true,
      },
      {
        relation: VerificationMethodRelationType.CapabilityInvocation,
        member: false,
      },
      {
        relation: VerificationMethodRelationType.CapabilityDelegation,
        member: false,
      },
    ]);
  });

  it("guards duplicate and missing relation membership before submitting transactions", () => {
    const state = ledgerState({
      authentication: ["#key-1"],
    });

    expect(() =>
      assertVerificationMethodRelationAbsent(
        state,
        VerificationMethodRelationType.AssertionMethod,
        "#key-1",
      ),
    ).not.toThrow();
    expect(() =>
      assertVerificationMethodRelationAbsent(
        state,
        VerificationMethodRelationType.Authentication,
        "#key-1",
      ),
    ).toThrow(
      "relation Authentication already contains verification method #key-1",
    );

    expect(() =>
      assertVerificationMethodRelationPresent(
        state,
        VerificationMethodRelationType.Authentication,
        "#key-1",
      ),
    ).not.toThrow();
    expect(() =>
      assertVerificationMethodRelationPresent(
        state,
        VerificationMethodRelationType.KeyAgreement,
        "#key-1",
      ),
    ).toThrow(
      "relation KeyAgreement does not contain verification method #key-1",
    );
  });

  it("guards relation compatibility before submitting transactions", () => {
    const state = ledgerState({
      verificationMethods: new Map([
        ["#ed", DIDContract.CurveType.Ed25519],
        ["#x", DIDContract.CurveType.X25519],
      ]),
      schnorrJubjubVerificationMethods: ["#jubjub"],
    });

    expect(() =>
      assertVerificationMethodRelationCompatible(
        state,
        VerificationMethodRelationType.Authentication,
        "#ed",
      ),
    ).not.toThrow();
    expect(() =>
      assertVerificationMethodRelationCompatible(
        state,
        VerificationMethodRelationType.Authentication,
        "#jubjub",
      ),
    ).not.toThrow();
    expect(() =>
      assertVerificationMethodRelationCompatible(
        state,
        VerificationMethodRelationType.KeyAgreement,
        "#x",
      ),
    ).not.toThrow();
    expect(() =>
      assertVerificationMethodRelationCompatible(
        state,
        VerificationMethodRelationType.KeyAgreement,
        "#ed",
      ),
    ).toThrow(/cannot be used/);
    expect(() =>
      assertVerificationMethodRelationCompatible(
        state,
        VerificationMethodRelationType.AssertionMethod,
        "#x",
      ),
    ).toThrow(/cannot be used/);
  });

  it("guards relation compatibility when updating an existing method curve", () => {
    const state = ledgerState({
      authentication: ["#auth"],
      keyAgreement: ["#agreement"],
    });

    expect(() =>
      assertExistingVerificationMethodRelationsCompatible(
        state,
        CurveType.Ed25519,
        "#auth",
      ),
    ).not.toThrow();
    expect(() =>
      assertExistingVerificationMethodRelationsCompatible(
        state,
        CurveType.X25519,
        "#agreement",
      ),
    ).not.toThrow();
    expect(() =>
      assertExistingVerificationMethodRelationsCompatible(
        state,
        CurveType.Ed25519,
        "#agreement",
      ),
    ).toThrow(/cannot be used/);
    expect(() =>
      assertExistingVerificationMethodRelationsCompatible(
        state,
        CurveType.X25519,
        "#auth",
      ),
    ).toThrow(/cannot be used/);
  });

  it.each(["opaque", "SchnorrJubjub"] as const)(
    "rejects a %s method referenced by all five relations with a typed, canonically ordered error",
    (kind) => {
      const methodId = kind === "opaque" ? "#key-1" : "#jubjub-1";
      const state = ledgerState({
        authentication: [methodId],
        assertionMethod: [methodId],
        keyAgreement: [methodId],
        capabilityInvocation: [methodId],
        capabilityDelegation: [methodId],
        ...(kind === "opaque"
          ? {
              verificationMethods: new Map([
                [methodId, DIDContract.CurveType.Ed25519],
              ]),
            }
          : { schnorrJubjubVerificationMethods: [methodId] }),
      });

      expect(() =>
        assertVerificationMethodIsNotReferenced(state, methodId),
      ).toThrow(VerificationMethodReferencedError);

      try {
        assertVerificationMethodIsNotReferenced(state, methodId);
        throw new Error("expected relation preflight to reject");
      } catch (error: unknown) {
        expect(error).toMatchObject({
          name: "VerificationMethodReferencedError",
          code: "verification_method_referenced",
          methodId,
          relations: [
            VerificationMethodRelationType.Authentication,
            VerificationMethodRelationType.AssertionMethod,
            VerificationMethodRelationType.KeyAgreement,
            VerificationMethodRelationType.CapabilityInvocation,
            VerificationMethodRelationType.CapabilityDelegation,
          ],
        });
        expect(
          Object.isFrozen(
            (error as VerificationMethodReferencedError).relations,
          ),
        ).toBe(true);
      }
    },
  );

  it("accepts methods absent from every verification relationship", () => {
    expect(() =>
      assertVerificationMethodIsNotReferenced(ledgerState(), "#key-1"),
    ).not.toThrow();
  });

  it("keeps undefined outside the supported relation sweep", () => {
    expect(VerificationMethodRelations).toEqual([
      VerificationMethodRelationType.Authentication,
      VerificationMethodRelationType.AssertionMethod,
      VerificationMethodRelationType.KeyAgreement,
      VerificationMethodRelationType.CapabilityInvocation,
      VerificationMethodRelationType.CapabilityDelegation,
    ]);
    expect(VerificationMethodRelations).not.toContain(
      VerificationMethodRelationType.Undefined,
    );
  });
});
