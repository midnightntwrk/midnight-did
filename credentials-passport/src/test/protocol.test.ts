import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { pureCircuits } from "../managed/passport-credential/contract/index.js";
import { createPassportCredentialProtocolFixture } from "./credential-fixtures.js";

setNetworkId("undeployed");

describe("passport credential: protocol layer", () => {
  it("maps a protocol verification request into the concrete passport presentation request shape", () => {
    const fixture = createPassportCredentialProtocolFixture();

    const request =
      pureCircuits.passportCredentialPresentationRequestFromProtocol(
        fixture.verificationRequest,
      );

    expect(request).toEqual(fixture.presentationRequest);
  });

  it("accepts a concrete issuance flow aligned to the generic protocol thread model", () => {
    const fixture = createPassportCredentialProtocolFixture();

    expect(() =>
      pureCircuits.assertPassportCredentialIssuanceRequestMatchesOffer(
        fixture.issuanceOffer,
        fixture.issuanceRequest,
      ),
    ).not.toThrow();

    expect(() =>
      pureCircuits.assertPassportCredentialIssuanceResultMatchesRequest(
        fixture.issuanceRequest,
        fixture.issuanceResult,
      ),
    ).not.toThrow();
  });

  it("rejects an issuance result when the holder binding does not match", () => {
    const fixture = createPassportCredentialProtocolFixture();
    const tamperedResult = {
      ...fixture.issuanceResult,
      body: {
        ...fixture.issuanceResult.body,
        issuanceChallengeHash: new Uint8Array(32).fill(3),
      },
    };

    expect(() =>
      pureCircuits.assertPassportCredentialIssuanceResultMatchesRequest(
        fixture.issuanceRequest,
        tamperedResult,
      ),
    ).toThrow(
      /Passport credential issuance result challenge must match the request challenge|Passport credential issuance result challenge must match the issuer proof challenge/,
    );
  });

  it("accepts a concrete verification flow aligned to the protocol thread model", () => {
    const fixture = createPassportCredentialProtocolFixture();

    expect(() =>
      pureCircuits.assertPassportCredentialVerificationSubmissionMatchesRequest(
        fixture.verificationRequest,
        fixture.verificationSubmission,
      ),
    ).not.toThrow();

    expect(() =>
      pureCircuits.assertPassportCredentialVerificationResultMatchesSubmission(
        fixture.verificationSubmission,
        fixture.verificationResult,
      ),
    ).not.toThrow();
  });
});
