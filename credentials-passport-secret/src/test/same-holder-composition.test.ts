import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { pureCircuits } from "../managed/secret-passport-credential/contract/index.js";
import { createSecretPassportCredentialFixture } from "./credential-fixtures.js";

setNetworkId("undeployed");

describe("secret passport credential: same-holder composition", () => {
  it("proves two secret passport credentials from different issuers belong to the same holder", () => {
    const firstFixture = createSecretPassportCredentialFixture();
    const secondFixture = createSecretPassportCredentialFixture({
      issuerLabel: "issuer-2",
      issuerSecretKey: 22334455n,
      holderSecret: firstFixture.witness.holderSecret,
      verifierDomainHash: firstFixture.witness.verifierDomainHash,
      holderSecretOpening: new Uint8Array(32).fill(21),
      holderBindingBlindingFactor: new Uint8Array(32).fill(22),
      holderBindingIssuerNonce: new Uint8Array(32).fill(23),
      documentNumber: new Uint8Array(32).fill(24),
      documentNumberOpening: new Uint8Array(32).fill(25),
      nationality: 840n,
      nationalityOpening: new Uint8Array(32).fill(26),
      givenNamePadded: new Uint8Array(32).fill(27),
      givenNameOpening: new Uint8Array(32).fill(28),
      familyNamePadded: new Uint8Array(32).fill(29),
      familyNameOpening: new Uint8Array(32).fill(30),
      birthDateDays: 3650n + 14n,
      birthDateOpening: new Uint8Array(32).fill(31),
      gender: 1n,
      genderOpening: new Uint8Array(32).fill(32),
      expiryDate: 26000n,
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
      pureCircuits.assertSameHolderSecretPassportPresentations(
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

  it("rejects same-holder proof when credentials have different holder secrets", () => {
    const firstFixture = createSecretPassportCredentialFixture();
    const secondFixture = createSecretPassportCredentialFixture({
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
      pureCircuits.assertSameHolderSecretPassportPresentations(
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

  it("proves three secret passport credentials from different issuers belong to the same holder", () => {
    const firstFixture = createSecretPassportCredentialFixture();
    const secondFixture = createSecretPassportCredentialFixture({
      issuerLabel: "issuer-2",
      issuerSecretKey: 22334455n,
      holderSecret: firstFixture.witness.holderSecret,
      verifierDomainHash: firstFixture.witness.verifierDomainHash,
      holderSecretOpening: new Uint8Array(32).fill(41),
      holderBindingBlindingFactor: new Uint8Array(32).fill(42),
      holderBindingIssuerNonce: new Uint8Array(32).fill(43),
      documentNumber: new Uint8Array(32).fill(44),
      documentNumberOpening: new Uint8Array(32).fill(45),
      nationality: 840n,
      nationalityOpening: new Uint8Array(32).fill(46),
      givenNamePadded: new Uint8Array(32).fill(47),
      givenNameOpening: new Uint8Array(32).fill(48),
      familyNamePadded: new Uint8Array(32).fill(49),
      familyNameOpening: new Uint8Array(32).fill(50),
      birthDateDays: 3650n + 14n,
      birthDateOpening: new Uint8Array(32).fill(51),
      gender: 1n,
      genderOpening: new Uint8Array(32).fill(52),
      expiryDate: 26000n,
      currentDay: firstFixture.witness.currentDay,
    });
    const thirdFixture = createSecretPassportCredentialFixture({
      issuerLabel: "issuer-3",
      issuerSecretKey: 99887766n,
      holderSecret: firstFixture.witness.holderSecret,
      verifierDomainHash: firstFixture.witness.verifierDomainHash,
      holderSecretOpening: new Uint8Array(32).fill(53),
      holderBindingBlindingFactor: new Uint8Array(32).fill(54),
      holderBindingIssuerNonce: new Uint8Array(32).fill(55),
      documentNumber: new Uint8Array(32).fill(56),
      documentNumberOpening: new Uint8Array(32).fill(57),
      nationality: 124n,
      nationalityOpening: new Uint8Array(32).fill(58),
      givenNamePadded: new Uint8Array(32).fill(59),
      givenNameOpening: new Uint8Array(32).fill(60),
      familyNamePadded: new Uint8Array(32).fill(61),
      familyNameOpening: new Uint8Array(32).fill(62),
      birthDateDays: 3650n + 21n,
      birthDateOpening: new Uint8Array(32).fill(63),
      gender: 2n,
      genderOpening: new Uint8Array(32).fill(64),
      expiryDate: 27000n,
      currentDay: firstFixture.witness.currentDay,
    });
    const sharedChallenge =
      firstFixture.verificationRequest.verifierChallengeHash;
    const secondRequest = {
      ...secondFixture.verificationRequest,
      verifierChallengeHash: sharedChallenge,
    };
    const thirdRequest = {
      ...thirdFixture.verificationRequest,
      verifierChallengeHash: sharedChallenge,
    };
    const secondPresentation = {
      ...secondFixture.presentation,
      holderBinding: {
        ...secondFixture.presentation.holderBinding,
        requestChallengeResponse:
          pureCircuits.secretHolderBindingChallengeResponse(
            secondFixture.witness.holderSecret,
            sharedChallenge,
          ),
      },
    };
    const thirdPresentation = {
      ...thirdFixture.presentation,
      holderBinding: {
        ...thirdFixture.presentation.holderBinding,
        requestChallengeResponse:
          pureCircuits.secretHolderBindingChallengeResponse(
            thirdFixture.witness.holderSecret,
            sharedChallenge,
          ),
      },
    };

    expect(() =>
      pureCircuits.assertSameHolderSecretPassportPresentations3(
        firstFixture.credential,
        firstFixture.credentialProof,
        firstFixture.verificationRequest,
        firstFixture.presentation,
        secondFixture.credential,
        secondFixture.credentialProof,
        secondRequest,
        secondPresentation,
        thirdFixture.credential,
        thirdFixture.credentialProof,
        thirdRequest,
        thirdPresentation,
        firstFixture.witness.holderSecret,
        firstFixture.witness.holderSecretOpening,
        firstFixture.witness.holderBindingBlindingFactor,
        secondFixture.witness.holderSecretOpening,
        secondFixture.witness.holderBindingBlindingFactor,
        thirdFixture.witness.holderSecretOpening,
        thirdFixture.witness.holderBindingBlindingFactor,
      ),
    ).not.toThrow();
  });

  it("rejects three-credential same-holder proof when the third passport belongs to a different holder", () => {
    const firstFixture = createSecretPassportCredentialFixture();
    const secondFixture = createSecretPassportCredentialFixture({
      issuerLabel: "issuer-2",
      issuerSecretKey: 22334455n,
      holderSecret: firstFixture.witness.holderSecret,
      holderSecretOpening: new Uint8Array(32).fill(65),
      holderBindingBlindingFactor: new Uint8Array(32).fill(66),
      holderBindingIssuerNonce: new Uint8Array(32).fill(67),
    });
    const thirdFixture = createSecretPassportCredentialFixture({
      issuerLabel: "issuer-3",
      issuerSecretKey: 99887766n,
      holderSecret: new Uint8Array(32).fill(68),
      holderSecretOpening: new Uint8Array(32).fill(69),
      holderBindingBlindingFactor: new Uint8Array(32).fill(70),
      holderBindingIssuerNonce: new Uint8Array(32).fill(71),
    });
    const sharedChallenge =
      firstFixture.verificationRequest.verifierChallengeHash;
    const secondRequest = {
      ...secondFixture.verificationRequest,
      verifierChallengeHash: sharedChallenge,
    };
    const thirdRequest = {
      ...thirdFixture.verificationRequest,
      verifierChallengeHash: sharedChallenge,
    };
    const secondPresentation = {
      ...secondFixture.presentation,
      holderBinding: {
        ...secondFixture.presentation.holderBinding,
        requestChallengeResponse:
          pureCircuits.secretHolderBindingChallengeResponse(
            secondFixture.witness.holderSecret,
            sharedChallenge,
          ),
      },
    };
    const thirdPresentation = {
      ...thirdFixture.presentation,
      holderBinding: {
        ...thirdFixture.presentation.holderBinding,
        requestChallengeResponse:
          pureCircuits.secretHolderBindingChallengeResponse(
            thirdFixture.witness.holderSecret,
            sharedChallenge,
          ),
      },
    };

    expect(() =>
      pureCircuits.assertSameHolderSecretPassportPresentations3(
        firstFixture.credential,
        firstFixture.credentialProof,
        firstFixture.verificationRequest,
        firstFixture.presentation,
        secondFixture.credential,
        secondFixture.credentialProof,
        secondRequest,
        secondPresentation,
        thirdFixture.credential,
        thirdFixture.credentialProof,
        thirdRequest,
        thirdPresentation,
        firstFixture.witness.holderSecret,
        firstFixture.witness.holderSecretOpening,
        firstFixture.witness.holderBindingBlindingFactor,
        secondFixture.witness.holderSecretOpening,
        secondFixture.witness.holderBindingBlindingFactor,
        thirdFixture.witness.holderSecretOpening,
        thirdFixture.witness.holderBindingBlindingFactor,
      ),
    ).toThrow(
      /Blinded holder commitment does not match the hidden holder secret witness/,
    );
  });
});
