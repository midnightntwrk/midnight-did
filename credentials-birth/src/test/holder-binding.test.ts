import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { pureCircuits } from "../managed/birth-credential/contract/index.js";
import { createBirthCredentialFixture } from "./credential-fixtures.js";

setNetworkId("undeployed");

describe("birth credential: holder binding", () => {
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
    ).toThrow(/Signature verification failed/);
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
    ).toThrow(/Signature verification failed/);
  });

  it("enforces a verifier-defined presentation request", () => {
    const fixture = createBirthCredentialFixture();

    expect(() =>
      pureCircuits.assertBirthPresentationSatisfiesRequest(
        fixture.credential,
        fixture.presentationRequest,
        fixture.presentation,
        fixture.presentationProof,
      ),
    ).not.toThrow();

    const stricterRequest = {
      ...fixture.presentationRequest,
      requireSubjectIdCommitmentDisclosure: true,
    };

    expect(() =>
      pureCircuits.assertBirthPresentationSatisfiesRequest(
        fixture.credential,
        stricterRequest,
        fixture.presentation,
        fixture.presentationProof,
      ),
    ).toThrow(
      /Presentation request requires the subject-id commitment disclosure/,
    );

    const mismatchedChallengeRequest = {
      ...fixture.presentationRequest,
      verifierChallengeHash: new Uint8Array(32).fill(9),
    };

    expect(() =>
      pureCircuits.assertBirthPresentationSatisfiesRequest(
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
