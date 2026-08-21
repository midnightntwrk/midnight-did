import { VerificationMethodRelationType } from "@midnight-ntwrk/midnight-did-domain";
import { describe, expect, it } from "vitest";

import { MidnightDidApiError } from "../api-errors.js";
import { DIDContractDeploymentFinalizedPrivateStateIncompleteError } from "../contract-lifecycle-operations.js";
import {
  PendingControllerPrivateStateBusyError,
  PendingControllerPrivateStateExistsError,
  PendingControllerPrivateStateUnavailableError,
  PrivateStateProviderContractMismatchError,
} from "../private-state.js";
import { VerificationMethodReferencedError } from "../verification-method-errors.js";
import { MidnightDidZkArtifactError } from "../zk-artifacts.js";

describe("typed API errors", () => {
  it.each([
    [
      new MidnightDidZkArtifactError("checksum_mismatch", "bad checksum"),
      MidnightDidZkArtifactError,
      "checksum_mismatch",
    ],
    [
      new VerificationMethodReferencedError("#key-1", [
        VerificationMethodRelationType.Authentication,
      ]),
      VerificationMethodReferencedError,
      "verification_method_referenced",
    ],
    [
      new DIDContractDeploymentFinalizedPrivateStateIncompleteError(
        "a".repeat(64),
        new Error("provider binding failed"),
        {
          deployedContract: {
            deployTxData: { public: { contractAddress: "a".repeat(64) } },
          },
        },
      ),
      DIDContractDeploymentFinalizedPrivateStateIncompleteError,
      "did_contract_deployment_finalized_private_state_incomplete",
    ],
    [
      new PendingControllerPrivateStateBusyError(),
      PendingControllerPrivateStateBusyError,
      "pending_controller_private_state_busy",
    ],
    [
      new PendingControllerPrivateStateExistsError(),
      PendingControllerPrivateStateExistsError,
      "pending_controller_private_state_exists",
    ],
    [
      new PendingControllerPrivateStateUnavailableError(),
      PendingControllerPrivateStateUnavailableError,
      "pending_controller_private_state_missing_or_malformed",
    ],
    [
      new PrivateStateProviderContractMismatchError(
        "a".repeat(64),
        "b".repeat(64),
      ),
      PrivateStateProviderContractMismatchError,
      "private_state_provider_contract_mismatch",
    ],
  ])(
    "uses the common constructor-owned code shape",
    (error, ErrorClass, code) => {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(MidnightDidApiError);
      expect(error).toBeInstanceOf(ErrorClass);
      expect(error).toMatchObject({ code });
    },
  );

  it("preserves public finalized deployment evidence without private state", () => {
    const publicDeployment = {
      deployTxData: { public: { contractAddress: "a".repeat(64) } },
    };
    const finalizedTxData = { status: "SucceedEntirely" };
    const cause = new Error("provider binding failed");
    const error = new DIDContractDeploymentFinalizedPrivateStateIncompleteError(
      "a".repeat(64),
      cause,
      { deployedContract: publicDeployment, finalizedTxData },
    );

    expect(error.contractAddress).toBe("a".repeat(64));
    expect(error.deployedContract).toBe(publicDeployment);
    expect(error.finalizedTxData).toBe(finalizedTxData);
    expect(error.cause).toBe(cause);
    expect(error).not.toHaveProperty("privateState");
    expect(JSON.stringify(error)).not.toContain("privateState");
  });

  it("preserves canonical provider contract mismatch details", () => {
    const error = new PrivateStateProviderContractMismatchError(
      "a".repeat(64),
      "b".repeat(64),
    );

    expect(error.expectedContractAddress).toBe("a".repeat(64));
    expect(error.actualContractAddress).toBe("b".repeat(64));
  });

  it("preserves verification-method error details", () => {
    const error = new VerificationMethodReferencedError("#key-1", [
      VerificationMethodRelationType.Authentication,
    ]);

    expect(error.methodId).toBe("#key-1");
    expect(error.relations).toEqual([
      VerificationMethodRelationType.Authentication,
    ]);
    expect(Object.isFrozen(error.relations)).toBe(true);
  });
});
