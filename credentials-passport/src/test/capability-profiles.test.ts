import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { pureCircuits } from "../managed/passport-credential/contract/index.js";
import {
  createPassportCredentialFixture,
  signProof,
} from "./credential-fixtures.js";

setNetworkId("undeployed");

describe("passport credential: capability profiles", () => {
  it("supports the simplest issuer-attested passport credential flow", () => {
    const fixture = createPassportCredentialFixture();

    expect(() =>
      pureCircuits.assertValidPassportCredential(
        fixture.credential,
        fixture.credentialProof,
      ),
    ).not.toThrow();
  });

  it("supports an operational flow with nationality disclosure and age predicate", () => {
    const fixture = createPassportCredentialFixture();
    const request = {
      ...fixture.presentationRequest,
      requireNationalityDisclosure: true,
      requireGenderDisclosure: false,
      requireAgeOverThreshold: true,
      requestedAgeThresholdYears: 18n,
      requireNotExpired: false,
    };
    const presentation = {
      ...fixture.presentation,
      disclosed: {
        ...fixture.presentation.disclosed,
        revealNationality: true,
        revealGender: false,
        genderValue: 0n,
        genderOpening: new Uint8Array(32),
        proveAgeOverThreshold: true,
        ageThresholdYears: 18n,
        proveNotExpired: false,
      },
    };
    const presentationProof = signProof({
      bodyRoot: pureCircuits.passportCredentialPresentationBodyRoot(presentation),
      context: "presentation",
      signer: fixture.holder,
      createdAt: fixture.presentationProof.createdAt + 2n,
      challengeHash: request.verifierChallengeHash,
      nonceScalar: 29n,
    });

    expect(() =>
      pureCircuits.assertValidPassportCredentialPresentation(
        fixture.credential,
        fixture.credentialProof,
        presentation,
        presentationProof,
      ),
    ).not.toThrow();

    expect(() =>
      pureCircuits.assertPassportPresentationSatisfiesRequest(
        fixture.credential,
        request,
        presentation,
        presentationProof,
      ),
    ).not.toThrow();
  });

  it("supports a stronger flow with nationality, gender, age predicate, and expiry check", () => {
    const fixture = createPassportCredentialFixture();

    const request = {
      ...fixture.presentationRequest,
      requireNationalityDisclosure: true,
      requireGenderDisclosure: true,
      requireAgeOverThreshold: true,
      requestedAgeThresholdYears: 18n,
      requireNotExpired: true,
    };

    const presentation = {
      ...fixture.presentation,
      disclosed: {
        ...fixture.presentation.disclosed,
        revealNationality: true,
        nationalityValue: fixture.witness.nationality,
        nationalityOpening: fixture.witness.nationalityOpening,
        revealGender: true,
        genderValue: fixture.witness.gender,
        genderOpening: fixture.witness.genderOpening,
        proveAgeOverThreshold: true,
        ageThresholdYears: 18n,
        proveNotExpired: true,
      },
    };

    const presentationProof = signProof({
      bodyRoot: pureCircuits.passportCredentialPresentationBodyRoot(presentation),
      context: "presentation",
      signer: fixture.holder,
      createdAt: fixture.presentationProof.createdAt + 3n,
      challengeHash: request.verifierChallengeHash,
      nonceScalar: 31n,
    });

    expect(() =>
      pureCircuits.assertValidPassportCredentialPresentation(
        fixture.credential,
        fixture.credentialProof,
        presentation,
        presentationProof,
      ),
    ).not.toThrow();

    expect(() =>
      pureCircuits.assertPassportPresentationSatisfiesRequest(
        fixture.credential,
        request,
        presentation,
        presentationProof,
      ),
    ).not.toThrow();

    expect(() =>
      pureCircuits.assertValidPassportCredentialAgePredicate(
        fixture.credential,
        presentation,
        fixture.witness.currentDay,
        fixture.witness.birthDateDays,
        fixture.witness.birthDateOpening,
      ),
    ).not.toThrow();

    expect(() =>
      pureCircuits.assertPassportNotExpired(
        fixture.credential,
        fixture.witness.currentDay,
      ),
    ).not.toThrow();
  });
});
