import { type DIDContract } from "@midnight-ntwrk/midnight-did-contract";
import { VerificationMethodRelationType } from "@midnight-ntwrk/midnight-did-domain";
import { describe, expect, it, vi } from "vitest";

import { LedgerVerificationMethodRelationMap } from "../ledger-mappers.js";
import { type DeployedMidnightDIDContract } from "../types.js";
import {
  assertVerificationMethodRelationAbsent,
  assertVerificationMethodRelationPresent,
  removePresentVerificationMethodRelations,
  verificationMethodRelationMemberships,
  VerificationMethodRelations,
} from "../verification-method-relations.js";

type LedgerRelationSets = {
  readonly authentication?: readonly string[];
  readonly assertionMethod?: readonly string[];
  readonly keyAgreement?: readonly string[];
  readonly capabilityInvocation?: readonly string[];
  readonly capabilityDelegation?: readonly string[];
};

const relationSet = (members: readonly string[]) => ({
  member: vi.fn((value: string) => members.includes(value)),
});

const ledgerState = ({
  authentication = [],
  assertionMethod = [],
  keyAgreement = [],
  capabilityInvocation = [],
  capabilityDelegation = [],
}: LedgerRelationSets = {}): DIDContract.Ledger =>
  ({
    authenticationRelation: relationSet(authentication),
    assertionMethodRelation: relationSet(assertionMethod),
    keyAgreementRelation: relationSet(keyAgreement),
    capabilityInvocationRelation: relationSet(capabilityInvocation),
    capabilityDelegationRelation: relationSet(capabilityDelegation),
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

  it("removes a method only from relations where it is present", async () => {
    const removeVerificationMethodRelation = vi.fn(async () => ({
      public: { txId: "0x1" },
    }));
    const didContract = {
      callTx: { removeVerificationMethodRelation },
    } as unknown as DeployedMidnightDIDContract;

    await removePresentVerificationMethodRelations(
      didContract,
      [
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
      ],
      "#key-1",
    );

    expect(removeVerificationMethodRelation).toHaveBeenCalledTimes(2);
    expect(removeVerificationMethodRelation).toHaveBeenNthCalledWith(
      1,
      LedgerVerificationMethodRelationMap[
        VerificationMethodRelationType.Authentication
      ],
      "#key-1",
    );
    expect(removeVerificationMethodRelation).toHaveBeenNthCalledWith(
      2,
      LedgerVerificationMethodRelationMap[
        VerificationMethodRelationType.KeyAgreement
      ],
      "#key-1",
    );
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
