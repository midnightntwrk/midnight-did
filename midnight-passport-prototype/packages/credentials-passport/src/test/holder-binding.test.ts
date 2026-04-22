import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { pureCircuits } from "../managed/passport-credential/contract/index.js";
import { createPassportCredentialFixture } from "./credential-fixtures.js";

setNetworkId("undeployed");

describe("passport credential: holder binding", () => {
  it("binds the issuer proof to the passport credential body", () => {
    const fixture = createPassportCredentialFixture();

    expect(() =>
      pureCircuits.assertValidPassportCredential(
        fixture.credential,
        fixture.credentialProof,
      ),
    ).not.toThrow();

    const tamperedCredential = {
      ...fixture.credential,
      issuedAt: fixture.credential.issuedAt + 1n,
    };

    expect(() =>
      pureCircuits.assertValidPassportCredential(
        tamperedCredential,
        fixture.credentialProof,
      ),
    ).toThrow(/Signature verification failed/);
  });

  it("binds the holder proof to the passport presentation body", () => {
    const fixture = createPassportCredentialFixture();

    expect(() =>
      pureCircuits.assertValidPassportCredentialPresentation(
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
      pureCircuits.assertValidPassportCredentialPresentation(
        fixture.credential,
        fixture.credentialProof,
        tamperedPresentation,
        fixture.presentationProof,
      ),
    ).toThrow(/Signature verification failed/);
  });

  it("enforces a verifier-defined passport presentation request", () => {
    const fixture = createPassportCredentialFixture();

    expect(() =>
      pureCircuits.assertPassportPresentationSatisfiesRequest(
        fixture.credential,
        fixture.presentationRequest,
        fixture.presentation,
        fixture.presentationProof,
      ),
    ).not.toThrow();

    const stricterRequest = {
      ...fixture.presentationRequest,
      requireGenderDisclosure: true,
    };

    expect(() =>
      pureCircuits.assertPassportPresentationSatisfiesRequest(
        fixture.credential,
        stricterRequest,
        fixture.presentation,
        fixture.presentationProof,
      ),
    ).toThrow(/Presentation request requires the gender disclosure/);

    const mismatchedChallengeRequest = {
      ...fixture.presentationRequest,
      verifierChallengeHash: new Uint8Array(32).fill(9),
    };

    expect(() =>
      pureCircuits.assertPassportPresentationSatisfiesRequest(
        fixture.credential,
        mismatchedChallengeRequest,
        fixture.presentation,
        fixture.presentationProof,
      ),
    ).toThrow(
      /Presentation proof challenge does not match the request challenge/,
    );
  });
});
