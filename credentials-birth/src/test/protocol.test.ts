import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { pureCircuits } from "../managed/birth-credential/contract/index.js";
import { createBirthCredentialProtocolFixture } from "./credential-fixtures.js";

setNetworkId("undeployed");

describe("birth credential: protocol layer", () => {
  it("maps a protocol verification request into the concrete presentation request shape", () => {
    const fixture = createBirthCredentialProtocolFixture();

    const request = pureCircuits.birthCredentialPresentationRequestFromProtocol(
      fixture.verificationRequest,
    );

    expect(request).toEqual(fixture.presentationRequest);
  });

  it("accepts a concrete issuance flow aligned to the generic protocol thread model", () => {
    const fixture = createBirthCredentialProtocolFixture();

    expect(() =>
      pureCircuits.assertBirthCredentialIssuanceRequestMatchesOffer(
        fixture.issuanceOffer,
        fixture.issuanceRequest,
      ),
    ).not.toThrow();

    expect(() =>
      pureCircuits.assertBirthCredentialIssuanceResultMatchesRequest(
        fixture.issuanceRequest,
        fixture.issuanceResult,
      ),
    ).not.toThrow();
  });

  it("rejects an issuance result when the issuance challenge no longer matches the request", () => {
    const fixture = createBirthCredentialProtocolFixture();
    const tamperedResult = {
      ...fixture.issuanceResult,
      body: {
        ...fixture.issuanceResult.body,
        issuanceChallengeHash: new Uint8Array(32).fill(3),
      },
    };

    expect(() =>
      pureCircuits.assertBirthCredentialIssuanceResultMatchesRequest(
        fixture.issuanceRequest,
        tamperedResult,
      ),
    ).toThrow(
      /Birth credential issuance result challenge must match the request challenge|Birth credential issuance result challenge must match the issuer proof challenge/,
    );
  });

  it("accepts a concrete verification submission aligned to the generic verification protocol", () => {
    const fixture = createBirthCredentialProtocolFixture();

    expect(() =>
      pureCircuits.assertBirthCredentialVerificationSubmissionMatchesRequest(
        fixture.verificationRequest,
        fixture.verificationSubmission,
      ),
    ).not.toThrow();

    expect(() =>
      pureCircuits.assertBirthCredentialVerificationResultMatchesSubmission(
        fixture.verificationSubmission,
        fixture.verificationResult,
      ),
    ).not.toThrow();
  });

  it("rejects a verification submission when the protocol challenge diverges from the request", () => {
    const fixture = createBirthCredentialProtocolFixture();
    const tamperedRequest = {
      ...fixture.verificationRequest,
      verifierChallengeHash: new Uint8Array(32).fill(9),
    };

    expect(() =>
      pureCircuits.assertBirthCredentialVerificationSubmissionMatchesRequest(
        tamperedRequest,
        fixture.verificationSubmission,
      ),
    ).toThrow(
      /Presentation submission challenge does not match the request challenge/,
    );
  });
});
