import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { createSanctionScreeningFixture } from "../fixtures/credential-fixtures.js";
import { pureCircuits } from "../managed/sanction-screening-credential/contract/index.js";

setNetworkId("undeployed");

describe("sanction screening credential: domain protocol", () => {
  it("validates issuance offer, request, and result alignment", () => {
    const fixture = createSanctionScreeningFixture();

    expect(() =>
      pureCircuits.assertValidSanctionScreeningCredentialIssuanceOffer(
        fixture.issuanceOffer,
      ),
    ).not.toThrow();
    expect(() =>
      pureCircuits.assertSanctionScreeningCredentialIssuanceRequestMatchesOffer(
        fixture.issuanceOffer,
        fixture.issuanceRequest,
      ),
    ).not.toThrow();
    expect(() =>
      pureCircuits.assertSanctionScreeningCredentialIssuanceResultMatchesRequest(
        fixture.issuanceRequest,
        fixture.issuanceResult,
      ),
    ).not.toThrow();
  });

  it("validates verification request, submission, and result alignment", () => {
    const fixture = createSanctionScreeningFixture();

    expect(() =>
      pureCircuits.assertSanctionScreeningCredentialVerificationSubmissionMatchesRequest(
        fixture.verificationRequest,
        fixture.verificationSubmission,
        fixture.witness.holderSecret,
        fixture.witness.holderSecretOpening,
        fixture.witness.holderBindingBlindingFactor,
      ),
    ).not.toThrow();
    expect(() =>
      pureCircuits.assertSanctionScreeningCredentialVerificationResultMatchesSubmission(
        fixture.verificationSubmission,
        fixture.verificationResult,
      ),
    ).not.toThrow();
  });

  it("rejects verification submissions that answer a different challenge", () => {
    const fixture = createSanctionScreeningFixture();
    const tamperedSubmission = {
      ...fixture.verificationSubmission,
      challengeHash: new Uint8Array(32).fill(9),
    };

    expect(() =>
      pureCircuits.assertSanctionScreeningCredentialVerificationSubmissionMatchesRequest(
        fixture.verificationRequest,
        tamperedSubmission,
        fixture.witness.holderSecret,
        fixture.witness.holderSecretOpening,
        fixture.witness.holderBindingBlindingFactor,
      ),
    ).toThrow(
      /Presentation submission challenge does not match the request challenge/,
    );
  });
});
