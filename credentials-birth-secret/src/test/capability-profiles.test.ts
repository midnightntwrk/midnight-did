import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { pureCircuits } from "../managed/secret-birth-credential/contract/index.js";
import { createSecretBirthCredentialFixture } from "./credential-fixtures.js";

setNetworkId("undeployed");

describe("secret birth credential: capability profiles", () => {
  it("supports a minimal privacy-preserving flow with hidden holder binding only", () => {
    const fixture = createSecretBirthCredentialFixture();
    const request = {
      ...fixture.presentationRequest,
      requireBirthCountryDisclosure: false,
      requireVerifierScopedPseudonym: false,
      requireAgeOverThreshold: false,
      requestedAgeThresholdYears: 0n,
    };
    const presentation = {
      ...fixture.presentation,
      disclosed: {
        ...fixture.presentation.disclosed,
        revealBirthCountryCode: false,
        revealVerifierScopedPseudonym: false,
        proveAgeOverThreshold: false,
        ageThresholdYears: 0n,
      },
    };

    expect(() =>
      pureCircuits.assertSecretBirthPresentationSatisfiesRequest(
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

  it("supports a hidden-holder flow with an age predicate", () => {
    const fixture = createSecretBirthCredentialFixture();
    const request = {
      ...fixture.presentationRequest,
      requireBirthCountryDisclosure: false,
      requireVerifierScopedPseudonym: false,
    };
    const presentation = {
      ...fixture.presentation,
      disclosed: {
        ...fixture.presentation.disclosed,
        revealBirthCountryCode: false,
        revealVerifierScopedPseudonym: false,
      },
    };

    expect(() =>
      pureCircuits.assertSecretBirthPresentationSatisfiesRequest(
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
      pureCircuits.assertValidSecretBirthCredentialAgePredicate(
        fixture.credential,
        presentation,
        fixture.witness.currentDay,
        fixture.witness.birthDateDays,
        fixture.witness.birthDateOpening,
      ),
    ).not.toThrow();
  });

  it("supports the advanced privacy profile with blinded holder binding, pseudonym, selective disclosure, and age predicate", () => {
    const fixture = createSecretBirthCredentialFixture();

    expect(() =>
      pureCircuits.assertSecretBirthPresentationSatisfiesRequest(
        fixture.credential,
        fixture.credentialProof,
        fixture.presentationRequest,
        fixture.presentation,
        fixture.witness.holderSecret,
        fixture.witness.holderSecretOpening,
        fixture.witness.holderBindingBlindingFactor,
      ),
    ).not.toThrow();

    expect(() =>
      pureCircuits.assertValidSecretBirthCredentialAgePredicate(
        fixture.credential,
        fixture.presentation,
        fixture.witness.currentDay,
        fixture.witness.birthDateDays,
        fixture.witness.birthDateOpening,
      ),
    ).not.toThrow();
  });
});
