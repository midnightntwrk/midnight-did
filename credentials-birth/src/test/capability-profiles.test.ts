import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { pureCircuits } from "../managed/birth-credential/contract/index.js";
import {
  createBirthCredentialFixture,
  signProof,
} from "./credential-fixtures.js";

setNetworkId("undeployed");

describe("birth credential: capability profiles", () => {
  it("supports the simplest issuer-attested source claim flow", () => {
    const fixture = createBirthCredentialFixture();

    expect(() =>
      pureCircuits.assertValidBirthCredential(
        fixture.credential,
        fixture.credentialProof,
      ),
    ).not.toThrow();
  });

  it("supports an operational flow with explicit holder binding and selective disclosure", () => {
    const fixture = createBirthCredentialFixture();
    const request = {
      ...fixture.presentationRequest,
      requireBirthCountryDisclosure: true,
      requireAgeOverThreshold: false,
      requestedAgeThresholdYears: 0n,
    };
    const presentation = {
      ...fixture.presentation,
      disclosed: {
        ...fixture.presentation.disclosed,
        revealBirthCountryCode: true,
        proveAgeOverThreshold: false,
        ageThresholdYears: 0n,
      },
    };
    const presentationProof = signProof({
      bodyRoot: pureCircuits.birthCredentialPresentationBodyRoot(presentation),
      context: "presentation",
      signer: fixture.holder,
      createdAt: fixture.presentationProof.createdAt + 2n,
      challengeHash: request.verifierChallengeHash,
      nonceScalar: 29n,
    });

    expect(() =>
      pureCircuits.assertValidBirthCredentialPresentation(
        fixture.credential,
        fixture.credentialProof,
        presentation,
        presentationProof,
      ),
    ).not.toThrow();

    expect(() =>
      pureCircuits.assertBirthPresentationSatisfiesRequest(
        fixture.credential,
        request,
        presentation,
        presentationProof,
      ),
    ).not.toThrow();
  });

  it("supports a stronger flow with explicit holder binding, selective disclosure, and age predicate", () => {
    const fixture = createBirthCredentialFixture();

    expect(() =>
      pureCircuits.assertValidBirthCredentialPresentation(
        fixture.credential,
        fixture.credentialProof,
        fixture.presentation,
        fixture.presentationProof,
      ),
    ).not.toThrow();

    expect(() =>
      pureCircuits.assertBirthPresentationSatisfiesRequest(
        fixture.credential,
        fixture.presentationRequest,
        fixture.presentation,
        fixture.presentationProof,
      ),
    ).not.toThrow();

    expect(() =>
      pureCircuits.assertValidBirthCredentialAgePredicate(
        fixture.credential,
        fixture.presentation,
        fixture.witness.currentDay,
        fixture.witness.birthDateDays,
        fixture.witness.birthDateOpening,
      ),
    ).not.toThrow();
  });
});
