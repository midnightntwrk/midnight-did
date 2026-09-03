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
        "target_reservation",
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

  it.each([
    "target_reservation",
    "private_state_persistence",
    "signing_key_persistence",
    "contract_handle_construction",
  ] as const)(
    "exposes only canonical finalized-deployment reconciliation fields at %s",
    (setupStage) => {
      const error =
        new DIDContractDeploymentFinalizedPrivateStateIncompleteError(
          "A".repeat(64),
          setupStage,
        );

      expect(error).toMatchObject({
        name: "DIDContractDeploymentFinalizedPrivateStateIncompleteError",
        code: "did_contract_deployment_finalized_private_state_incomplete",
        contractAddress: "a".repeat(64),
        setupStage,
      });
      expect(Reflect.ownKeys(error).sort()).toEqual(
        [
          "stack",
          "message",
          "code",
          "setupStage",
          "name",
          "contractAddress",
        ].sort(),
      );
      expect(error).not.toHaveProperty("cause");
      expect(error).not.toHaveProperty("deployedContract");
      expect(error).not.toHaveProperty("deployTxData");
      expect(error).not.toHaveProperty("finalizedTxData");
      expect(error).not.toHaveProperty("transaction");
      expect(JSON.parse(JSON.stringify(error))).toEqual({
        code: "did_contract_deployment_finalized_private_state_incomplete",
        setupStage,
        name: "DIDContractDeploymentFinalizedPrivateStateIncompleteError",
        contractAddress: "a".repeat(64),
      });
    },
  );

  it("rejects arbitrary finalized-deployment setup stage text", () => {
    expect(
      () =>
        new DIDContractDeploymentFinalizedPrivateStateIncompleteError(
          "a".repeat(64),
          "provider-secret-message" as never,
        ),
    ).toThrow("Invalid finalized deployment setup stage");
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
