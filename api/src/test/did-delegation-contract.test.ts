import { describe, expect, it } from "vitest";

import {
  applyDelegationTransition,
  assertDelegationActive,
  type DelegationHistoryQuery,
  type DelegationState,
  DelegationTemplateError,
  delegationTemplateFixturePath,
  evaluateDelegation,
  getDelegationHistory,
  loadDelegationStateFromFile,
  loadDelegationTemplateFromFile,
  rotateDelegationKey,
  templateToGrantEvent,
} from "../did-delegation";

const BASELINE_STATE = loadDelegationStateFromFile(
  delegationTemplateFixturePath("delegation-baseline-state.json"),
);

const AGENT_TEMPLATE = loadDelegationTemplateFromFile(
  delegationTemplateFixturePath("delegation-template-agent.json"),
);

describe("did delegation lifecycle", () => {
  it("supports deterministic grant templating for agent delegations", () => {
    expect(AGENT_TEMPLATE.templateVersion).toBe("v1");
    expect(AGENT_TEMPLATE.verificationMethod).toBe("#agent-op-key-v1");
    expect(AGENT_TEMPLATE.delegatorDid).toBe(
      "did:midnight:university:state-college",
    );
  });

  it("supports delegated key rotation and keeps the old key inactive afterwards", () => {
    let rotatedState: DelegationState = applyDelegationTransition(
      BASELINE_STATE,
      templateToGrantEvent(AGENT_TEMPLATE, {
        effectiveAt: "2026-06-01T00:00:00.000Z",
        reason: "initial grant from template fixture",
      }),
    );

    rotatedState = rotateDelegationKey(rotatedState, {
      delegatorDid: "did:midnight:university:state-college",
      delegateDid: "did:midnight:agent:grants-ops",
      actorDid: "did:midnight:university:state-college",
      relationship: "capabilityInvocation",
      fromVerificationMethod: "#agent-op-key-v1",
      toVerificationMethod: "#agent-op-key-v2",
      effectiveAt: "2026-07-01T00:00:00.000Z",
      reason: "operational key rotation",
    });

    const postRotationOld = evaluateDelegation(
      rotatedState,
      {
        delegatorDid: "did:midnight:university:state-college",
        delegateDid: "did:midnight:agent:grants-ops",
        relationship: "capabilityInvocation",
        verificationMethod: "#agent-op-key-v1",
      },
      "2026-07-02T00:00:00.000Z",
    );
    expect(postRotationOld.isActive).toBe(false);

    const postRotationCurrent = evaluateDelegation(
      rotatedState,
      {
        delegatorDid: "did:midnight:university:state-college",
        delegateDid: "did:midnight:agent:grants-ops",
        relationship: "capabilityInvocation",
        verificationMethod: "#agent-op-key-v2",
      },
      "2026-07-02T00:00:00.000Z",
    );
    expect(postRotationCurrent.isActive).toBe(true);
    expect(postRotationCurrent.activeVerificationMethods).toEqual([
      "#agent-op-key-v2",
    ]);

    const serviceRole: DelegationHistoryQuery = {
      delegatorDid: "did:midnight:university:state-college",
      delegateDid: "did:midnight:service:transcript-api",
      relationship: "capabilityDelegation",
    };
    const serviceDecision = evaluateDelegation(
      rotatedState,
      serviceRole,
      "2026-07-02T00:00:00.000Z",
    );
    expect(serviceDecision.isActive).toBe(true);
    expect(serviceDecision.activeVerificationMethods).toEqual([
      "#service-key-v1",
    ]);
  });

  it("supports revoke and returns an actionable inactive decision", () => {
    const withRevokedState = applyDelegationTransition(BASELINE_STATE, {
      action: "revoke",
      delegatorDid: "did:midnight:university:state-college",
      delegateDid: "did:midnight:agent:grants-ops",
      actorDid: "did:midnight:university:state-college",
      relationship: "capabilityInvocation",
      verificationMethod: "#agent-op-key-v1",
      effectiveAt: "2026-06-20T00:00:00.000Z",
      reason: "agent key removed after security incident",
    });

    expect(() =>
      assertDelegationActive(
        withRevokedState,
        {
          delegatorDid: "did:midnight:university:state-college",
          delegateDid: "did:midnight:agent:grants-ops",
          relationship: "capabilityInvocation",
          verificationMethod: "#agent-op-key-v1",
        },
        "2026-06-21T00:00:00.000Z",
      ),
    ).toThrowError(DelegationTemplateError);
  });

  it("exposes history sorted for delegation transitions", () => {
    let stateWithRotation = BASELINE_STATE;
    stateWithRotation = applyDelegationTransition(
      stateWithRotation,
      templateToGrantEvent(AGENT_TEMPLATE),
    );
    stateWithRotation = rotateDelegationKey(stateWithRotation, {
      delegatorDid: "did:midnight:university:state-college",
      delegateDid: "did:midnight:agent:grants-ops",
      actorDid: "did:midnight:university:state-college",
      relationship: "capabilityInvocation",
      fromVerificationMethod: "#agent-op-key-v1",
      toVerificationMethod: "#agent-op-key-v2",
      effectiveAt: "2026-07-01T00:00:00.000Z",
    });
    stateWithRotation = applyDelegationTransition(stateWithRotation, {
      action: "revoke",
      delegatorDid: "did:midnight:university:state-college",
      delegateDid: "did:midnight:agent:grants-ops",
      actorDid: "did:midnight:university:state-college",
      relationship: "capabilityInvocation",
      verificationMethod: "#agent-op-key-v2",
      effectiveAt: "2026-07-15T00:00:00.000Z",
      reason: "post-rotation cleanup",
    });

    const history = getDelegationHistory(stateWithRotation, {
      delegatorDid: "did:midnight:university:state-college",
      delegateDid: "did:midnight:agent:grants-ops",
      relationship: "capabilityInvocation",
    });
    expect(history).toHaveLength(4);
    expect(history[0].action).toBe("grant");
    expect(history[1].action).toBe("grant");
    expect(history[2].action).toBe("rotate");
    expect(history[3].action).toBe("revoke");
  });
});
