import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { createSecretPassportCredentialFixture } from "../fixtures/credential-fixtures.js";
import { pureCircuits } from "../managed/secret-passport-credential/contract/index.js";

setNetworkId("undeployed");

describe("secret passport credential: capability profiles", () => {
  it("supports a minimal privacy flow with hidden holder binding only", () => {
    const fixture = createSecretPassportCredentialFixture();
    const request = {
      ...fixture.presentationRequest,
      requireNationalityDisclosure: false,
      requireGenderDisclosure: false,
      requireVerifierScopedPseudonym: false,
      requireAgeOverThreshold: false,
      requestedAgeThresholdYears: 0n,
      requireNotExpired: false,
    };
    const presentation = {
      ...fixture.presentation,
      disclosed: {
        ...fixture.presentation.disclosed,
        revealNationality: false,
        nationalityValue: 0n,
        nationalityOpening: new Uint8Array(32),
        revealGender: false,
        revealVerifierScopedPseudonym: false,
        proveAgeOverThreshold: false,
        ageThresholdYears: 0n,
        proveNotExpired: false,
      },
    };

    expect(() =>
      pureCircuits.assertSecretPassportPresentationSatisfiesRequest(
        fixture.credential,
        fixture.credentialProof,
        request,
        presentation,
        fixture.witness.holderSecret,
        fixture.witness.holderSecretOpening,
        fixture.witness.holderBindingBlindingFactor,
      ),
    ).not.toThrow();
  });

  it("supports hidden-holder with age predicate and expiry check", () => {
    const fixture = createSecretPassportCredentialFixture();
    const request = {
      ...fixture.presentationRequest,
      requireNationalityDisclosure: false,
      requireGenderDisclosure: false,
      requireVerifierScopedPseudonym: false,
      requireNotExpired: true,
    };
    const presentation = {
      ...fixture.presentation,
      disclosed: {
        ...fixture.presentation.disclosed,
        revealNationality: false,
        nationalityValue: 0n,
        nationalityOpening: new Uint8Array(32),
        revealGender: false,
        revealVerifierScopedPseudonym: false,
        proveNotExpired: true,
      },
    };

    expect(() =>
      pureCircuits.assertSecretPassportPresentationSatisfiesRequest(
        fixture.credential,
        fixture.credentialProof,
        request,
        presentation,
        fixture.witness.holderSecret,
        fixture.witness.holderSecretOpening,
        fixture.witness.holderBindingBlindingFactor,
      ),
    ).not.toThrow();

    expect(() =>
      pureCircuits.assertValidSecretPassportCredentialAgePredicate(
        fixture.credential,
        presentation,
        fixture.witness.currentDay,
        fixture.witness.birthDateDays,
        fixture.witness.birthDateOpening,
      ),
    ).not.toThrow();

    expect(() =>
      pureCircuits.assertSecretPassportNotExpired(
        fixture.credential,
        fixture.witness.currentDay,
      ),
    ).not.toThrow();
  });

  it("supports advanced profile with pseudonym, nationality, gender, age, and expiry", () => {
    const fixture = createSecretPassportCredentialFixture();
    const request = {
      ...fixture.presentationRequest,
      requireNationalityDisclosure: true,
      requireGenderDisclosure: true,
      requireVerifierScopedPseudonym: true,
      requireAgeOverThreshold: true,
      requestedAgeThresholdYears: 18n,
      requireNotExpired: true,
    };
    const presentation = {
      ...fixture.presentation,
      disclosed: {
        ...fixture.presentation.disclosed,
        revealNationality: true,
        revealGender: true,
        genderValue: fixture.witness.gender,
        genderOpening: fixture.witness.genderOpening,
        revealVerifierScopedPseudonym: true,
        proveAgeOverThreshold: true,
        ageThresholdYears: 18n,
        proveNotExpired: true,
      },
    };

    expect(() =>
      pureCircuits.assertSecretPassportPresentationSatisfiesRequest(
        fixture.credential,
        fixture.credentialProof,
        request,
        presentation,
        fixture.witness.holderSecret,
        fixture.witness.holderSecretOpening,
        fixture.witness.holderBindingBlindingFactor,
      ),
    ).not.toThrow();

    expect(() =>
      pureCircuits.assertValidSecretPassportCredentialAgePredicate(
        fixture.credential,
        presentation,
        fixture.witness.currentDay,
        fixture.witness.birthDateDays,
        fixture.witness.birthDateOpening,
      ),
    ).not.toThrow();

    expect(() =>
      pureCircuits.assertSecretPassportNotExpired(
        fixture.credential,
        fixture.witness.currentDay,
      ),
    ).not.toThrow();
  });
});
