import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { pureCircuits } from "../managed/credentials/contract/index.js";
import {
  createBirthCredentialFixture,
  signCredentialProof,
} from "./credential-fixtures.js";

setNetworkId("undeployed");

describe("credentials compact flows", () => {
  it("binds the issuer proof to the credential body", () => {
    const fixture = createBirthCredentialFixture();

    expect(() =>
      pureCircuits.assertValidBirthCredential(
        fixture.credential,
        fixture.credentialProof,
      ),
    ).not.toThrow();

    const tamperedCredential = {
      ...fixture.credential,
      issuedAt: fixture.credential.issuedAt + 1n,
    };

    expect(() =>
      pureCircuits.assertValidBirthCredential(
        tamperedCredential,
        fixture.credentialProof,
      ),
    ).toThrow(/Jubjub signature verification failed/);
  });

  it("binds the holder proof to the presentation body", () => {
    const fixture = createBirthCredentialFixture();

    expect(() =>
      pureCircuits.assertValidBirthCredentialPresentation(
        fixture.credential,
        fixture.credentialProof,
        fixture.presentation,
        fixture.presentationProof,
      ),
    ).not.toThrow();

    const tamperedPresentation = {
      ...fixture.presentation,
      disclosed: {
        ...fixture.presentation.disclosed,
        ageThresholdYears:
          fixture.presentation.disclosed.ageThresholdYears + 1n,
      },
    };

    expect(() =>
      pureCircuits.assertValidBirthCredentialPresentation(
        fixture.credential,
        fixture.credentialProof,
        tamperedPresentation,
        fixture.presentationProof,
      ),
    ).toThrow(/Jubjub signature verification failed/);
  });

  it("checks the private age witness against the committed birth date", () => {
    const fixture = createBirthCredentialFixture();

    expect(() =>
      pureCircuits.assertValidBirthCredentialAgePredicate(
        fixture.credential,
        fixture.presentation,
        fixture.witness.currentDay,
        fixture.witness.birthDateDays,
        fixture.witness.birthDateOpening,
      ),
    ).not.toThrow();

    expect(() =>
      pureCircuits.assertValidBirthCredentialAgePredicate(
        fixture.credential,
        fixture.presentation,
        fixture.witness.currentDay,
        fixture.witness.birthDateDays,
        new Uint8Array(32).fill(1),
      ),
    ).toThrow(/Birth-date witness does not match credential commitment/);
  });

  it("rejects a predicate proof when the holder is below the requested threshold", () => {
    const fixture = createBirthCredentialFixture();

    const strictPresentation = {
      ...fixture.presentation,
      disclosed: {
        ...fixture.presentation.disclosed,
        ageThresholdYears: 30n,
      },
    };
    const strictPresentationProof = signCredentialProof({
      bodyRoot:
        pureCircuits.birthCredentialPresentationBodyRoot(strictPresentation),
      purpose: fixture.presentationProof.purpose,
      signer: fixture.holder,
      createdAt: fixture.presentationProof.createdAt + 1n,
      challengeHash: fixture.presentationProof.challengeHash,
      nonceScalar: 23n,
    });

    expect(() =>
      pureCircuits.assertValidBirthCredentialPresentation(
        fixture.credential,
        fixture.credentialProof,
        strictPresentation,
        strictPresentationProof,
      ),
    ).not.toThrow();

    expect(() =>
      pureCircuits.assertValidBirthCredentialAgePredicate(
        fixture.credential,
        strictPresentation,
        fixture.witness.currentDay,
        fixture.witness.birthDateDays,
        fixture.witness.birthDateOpening,
      ),
    ).toThrow(/Age predicate does not satisfy the requested threshold/);
  });
});
