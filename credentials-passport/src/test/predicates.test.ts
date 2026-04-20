import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { pureCircuits } from "../managed/passport-credential/contract/index.js";
import {
  createPassportCredentialFixture,
  signProof,
} from "./credential-fixtures.js";

setNetworkId("undeployed");

describe("passport credential: predicates", () => {
  it("validates age predicate against birth date witness", () => {
    const fixture = createPassportCredentialFixture();

    expect(() =>
      pureCircuits.assertValidPassportCredentialAgePredicate(
        fixture.credential,
        fixture.presentation,
        fixture.witness.currentDay,
        fixture.witness.birthDateDays,
        fixture.witness.birthDateOpening,
      ),
    ).not.toThrow();

    expect(() =>
      pureCircuits.assertValidPassportCredentialAgePredicate(
        fixture.credential,
        fixture.presentation,
        fixture.witness.currentDay,
        fixture.witness.birthDateDays,
        new Uint8Array(32).fill(1),
      ),
    ).toThrow(/Birth-date witness does not match credential commitment/);
  });

  it("rejects age predicate when holder is below threshold", () => {
    const fixture = createPassportCredentialFixture();

    const strictPresentation = {
      ...fixture.presentation,
      disclosed: {
        ...fixture.presentation.disclosed,
        ageThresholdYears: 30n,
      },
    };
    const strictPresentationProof = signProof({
      bodyRoot:
        pureCircuits.passportCredentialPresentationBodyRoot(strictPresentation),
      context: "presentation",
      signer: fixture.holder,
      createdAt: fixture.presentationProof.createdAt + 1n,
      challengeHash: fixture.presentationProof.challengeHash,
      nonceScalar: 23n,
    });

    expect(() =>
      pureCircuits.assertValidPassportCredentialPresentation(
        fixture.credential,
        fixture.credentialProof,
        strictPresentation,
        strictPresentationProof,
      ),
    ).not.toThrow();

    expect(() =>
      pureCircuits.assertValidPassportCredentialAgePredicate(
        fixture.credential,
        strictPresentation,
        fixture.witness.currentDay,
        fixture.witness.birthDateDays,
        fixture.witness.birthDateOpening,
      ),
    ).toThrow(/Age predicate does not satisfy the requested threshold/);
  });

  it("validates passport not-expired predicate", () => {
    const fixture = createPassportCredentialFixture();

    expect(() =>
      pureCircuits.assertPassportNotExpired(
        fixture.credential,
        fixture.witness.currentDay,
      ),
    ).not.toThrow();
  });

  it("rejects presentation when passport has expired", () => {
    const fixture = createPassportCredentialFixture();

    expect(() =>
      pureCircuits.assertPassportNotExpired(fixture.credential, 30000n),
    ).toThrow(/Passport has expired/);
  });
});
