import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { pureCircuits } from "../managed/secret-birth-credential/contract/index.js";
import { createSecretBirthCredentialFixture } from "./credential-fixtures.js";

setNetworkId("undeployed");

describe("secret birth credential: same-holder composition", () => {
  it("supports same-holder composition across two secret birth credentials with different issuance anchors", () => {
    const firstFixture = createSecretBirthCredentialFixture();
    const secondFixture = createSecretBirthCredentialFixture({
      issuerLabel: "issuer-2",
      issuerSecretKey: 22334455n,
      holderSecret: firstFixture.witness.holderSecret,
      verifierDomainHash: firstFixture.witness.verifierDomainHash,
      holderSecretOpening: new Uint8Array(32).fill(21),
      holderBindingBlindingFactor: new Uint8Array(32).fill(22),
      holderBindingIssuerNonce: new Uint8Array(32).fill(23),
      subjectId: new Uint8Array(32).fill(24),
      subjectOpening: new Uint8Array(32).fill(25),
      legalNamePadded: new Uint8Array(32).fill(26),
      legalNameOpening: new Uint8Array(32).fill(27),
      birthDateDays: 3650n + 14n,
      birthDateOpening: new Uint8Array(32).fill(28),
      birthCountryCodePadded: new Uint8Array(32).fill(29),
      birthCountryCodeOpening: new Uint8Array(32).fill(30),
      currentDay: firstFixture.witness.currentDay,
    });
    const secondRequest = {
      ...secondFixture.verificationRequest,
      verifierChallengeHash:
        firstFixture.verificationRequest.verifierChallengeHash,
    };
    const secondPresentation = {
      ...secondFixture.presentation,
      holderBinding: {
        ...secondFixture.presentation.holderBinding,
        requestChallengeResponse:
          pureCircuits.secretHolderBindingChallengeResponse(
            secondFixture.witness.holderSecret,
            secondRequest.verifierChallengeHash,
          ),
      },
    };

    expect(() =>
      pureCircuits.assertSameHolderSecretBirthPresentations(
        firstFixture.credential,
        firstFixture.credentialProof,
        firstFixture.verificationRequest,
        firstFixture.presentation,
        secondFixture.credential,
        secondFixture.credentialProof,
        secondRequest,
        secondPresentation,
        firstFixture.witness.holderSecret,
        firstFixture.witness.holderSecretOpening,
        firstFixture.witness.holderBindingBlindingFactor,
        secondFixture.witness.holderSecretOpening,
        secondFixture.witness.holderBindingBlindingFactor,
      ),
    ).not.toThrow();
  });

  it("rejects same-holder composition when the second credential belongs to a different holder secret", () => {
    const firstFixture = createSecretBirthCredentialFixture();
    const secondFixture = createSecretBirthCredentialFixture({
      issuerLabel: "issuer-2",
      issuerSecretKey: 22334455n,
      holderSecret: new Uint8Array(32).fill(88),
      holderSecretOpening: new Uint8Array(32).fill(31),
      holderBindingBlindingFactor: new Uint8Array(32).fill(32),
      holderBindingIssuerNonce: new Uint8Array(32).fill(33),
    });
    const secondRequest = {
      ...secondFixture.verificationRequest,
      verifierChallengeHash:
        firstFixture.verificationRequest.verifierChallengeHash,
    };
    const secondPresentation = {
      ...secondFixture.presentation,
      holderBinding: {
        ...secondFixture.presentation.holderBinding,
        requestChallengeResponse:
          pureCircuits.secretHolderBindingChallengeResponse(
            secondFixture.witness.holderSecret,
            secondRequest.verifierChallengeHash,
          ),
      },
    };

    expect(() =>
      pureCircuits.assertSameHolderSecretBirthPresentations(
        firstFixture.credential,
        firstFixture.credentialProof,
        firstFixture.verificationRequest,
        firstFixture.presentation,
        secondFixture.credential,
        secondFixture.credentialProof,
        secondRequest,
        secondPresentation,
        firstFixture.witness.holderSecret,
        firstFixture.witness.holderSecretOpening,
        firstFixture.witness.holderBindingBlindingFactor,
        secondFixture.witness.holderSecretOpening,
        secondFixture.witness.holderBindingBlindingFactor,
      ),
    ).toThrow(
      /Blinded holder commitment does not match the hidden holder secret witness/,
    );
  });

  it("rejects same-holder composition when the verifier challenge is not shared", () => {
    const firstFixture = createSecretBirthCredentialFixture();
    const secondFixture = createSecretBirthCredentialFixture({
      issuerLabel: "issuer-2",
      issuerSecretKey: 22334455n,
      holderSecret: firstFixture.witness.holderSecret,
      holderSecretOpening: new Uint8Array(32).fill(34),
      holderBindingBlindingFactor: new Uint8Array(32).fill(35),
      holderBindingIssuerNonce: new Uint8Array(32).fill(36),
    });
    const mismatchedSecondRequest = {
      ...secondFixture.verificationRequest,
      verifierChallengeHash: new Uint8Array(32).fill(89),
    };

    expect(() =>
      pureCircuits.assertSameHolderSecretBirthPresentations(
        firstFixture.credential,
        firstFixture.credentialProof,
        firstFixture.verificationRequest,
        firstFixture.presentation,
        secondFixture.credential,
        secondFixture.credentialProof,
        mismatchedSecondRequest,
        secondFixture.presentation,
        firstFixture.witness.holderSecret,
        firstFixture.witness.holderSecretOpening,
        firstFixture.witness.holderBindingBlindingFactor,
        secondFixture.witness.holderSecretOpening,
        secondFixture.witness.holderBindingBlindingFactor,
      ),
    ).toThrow(/Same-holder composition requires a shared verifier challenge/);
  });
});
