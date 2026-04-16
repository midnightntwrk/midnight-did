import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { pureCircuits as credentialsPureCircuits } from "../../../credentials/src/managed/credentials/contract/index.js";
import { pureCircuits } from "../managed/same-holder/contract/index.js";

setNetworkId("undeployed");

describe("same-holder capability", () => {
  it("proves two blinded holder bindings belong to the same hidden holder secret", () => {
    const holderSecret = new Uint8Array(32).fill(11);
    const verifierChallengeHash = new Uint8Array(32).fill(12);

    const firstOpening = new Uint8Array(32).fill(13);
    const firstBlindingFactor = new Uint8Array(32).fill(14);
    const firstIssuerNonce = new Uint8Array(32).fill(15);
    const firstHolderCommitment =
      credentialsPureCircuits.secretHolderBindingCommitment(
        holderSecret,
        firstOpening,
      );
    const firstBinding = {
      blindedHolderSecretCommitment:
        credentialsPureCircuits.blindedSecretHolderCommitment(
          firstHolderCommitment,
          firstIssuerNonce,
          firstBlindingFactor,
        ),
      issuerNonce: firstIssuerNonce,
      requestChallengeResponse:
        credentialsPureCircuits.secretHolderBindingChallengeResponse(
          holderSecret,
          verifierChallengeHash,
        ),
    };

    const secondOpening = new Uint8Array(32).fill(16);
    const secondBlindingFactor = new Uint8Array(32).fill(17);
    const secondIssuerNonce = new Uint8Array(32).fill(18);
    const secondHolderCommitment =
      credentialsPureCircuits.secretHolderBindingCommitment(
        holderSecret,
        secondOpening,
      );
    const secondBinding = {
      blindedHolderSecretCommitment:
        credentialsPureCircuits.blindedSecretHolderCommitment(
          secondHolderCommitment,
          secondIssuerNonce,
          secondBlindingFactor,
        ),
      issuerNonce: secondIssuerNonce,
      requestChallengeResponse:
        credentialsPureCircuits.secretHolderBindingChallengeResponse(
          holderSecret,
          verifierChallengeHash,
        ),
    };

    expect(() =>
      pureCircuits.assertSameBlindedSecretHolderBindingWitnesses(
        firstBinding,
        secondBinding,
        verifierChallengeHash,
        holderSecret,
        firstOpening,
        firstBlindingFactor,
        secondOpening,
        secondBlindingFactor,
      ),
    ).not.toThrow();
  });

  it("rejects same-holder proof when one blinded binding belongs to a different hidden secret", () => {
    const holderSecret = new Uint8Array(32).fill(21);
    const verifierChallengeHash = new Uint8Array(32).fill(22);

    const firstOpening = new Uint8Array(32).fill(23);
    const firstBlindingFactor = new Uint8Array(32).fill(24);
    const firstIssuerNonce = new Uint8Array(32).fill(25);
    const firstBinding = {
      blindedHolderSecretCommitment:
        credentialsPureCircuits.blindedSecretHolderCommitment(
          credentialsPureCircuits.secretHolderBindingCommitment(
            holderSecret,
            firstOpening,
          ),
          firstIssuerNonce,
          firstBlindingFactor,
        ),
      issuerNonce: firstIssuerNonce,
      requestChallengeResponse:
        credentialsPureCircuits.secretHolderBindingChallengeResponse(
          holderSecret,
          verifierChallengeHash,
        ),
    };

    const secondOpening = new Uint8Array(32).fill(26);
    const secondBlindingFactor = new Uint8Array(32).fill(27);
    const secondIssuerNonce = new Uint8Array(32).fill(28);
    const secondHolderSecret = new Uint8Array(32).fill(29);
    const secondBinding = {
      blindedHolderSecretCommitment:
        credentialsPureCircuits.blindedSecretHolderCommitment(
          credentialsPureCircuits.secretHolderBindingCommitment(
            secondHolderSecret,
            secondOpening,
          ),
          secondIssuerNonce,
          secondBlindingFactor,
        ),
      issuerNonce: secondIssuerNonce,
      requestChallengeResponse:
        credentialsPureCircuits.secretHolderBindingChallengeResponse(
          secondHolderSecret,
          verifierChallengeHash,
        ),
    };

    expect(() =>
      pureCircuits.assertSameBlindedSecretHolderBindingWitnesses(
        firstBinding,
        secondBinding,
        verifierChallengeHash,
        holderSecret,
        firstOpening,
        firstBlindingFactor,
        secondOpening,
        secondBlindingFactor,
      ),
    ).toThrow(
      /Blinded holder commitment does not match the hidden holder secret witness/,
    );
  });
});
