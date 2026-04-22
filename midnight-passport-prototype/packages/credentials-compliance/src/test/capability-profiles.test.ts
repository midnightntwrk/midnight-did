import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { createSanctionScreeningFixture } from "../fixtures/credential-fixtures.js";
import { pureCircuits } from "../managed/sanction-screening-credential/contract/index.js";

setNetworkId("undeployed");

describe("sanction screening credential: capability profiles", () => {
  it("supports a minimal hidden-holder verification flow", () => {
    const fixture = createSanctionScreeningFixture();
    const request = {
      ...fixture.presentationRequest,
      requireScreeningResultPass: false,
      requirePepFalse: false,
      requireVerifierScopedPseudonym: false,
      requireScreeningFresh: false,
      maxScreeningAgeDays: 0n,
      requireNotExpired: false,
    };
    const presentation = {
      ...fixture.presentation,
      disclosed: {
        ...fixture.presentation.disclosed,
        revealScreeningResult: false,
        screeningResult: 0n,
        revealPepStatus: false,
        isPep: false,
        revealVerifierScopedPseudonym: false,
        proveScreeningFresh: false,
        maxScreeningAgeDays: 0n,
        proveNotExpired: false,
      },
    };

    expect(() =>
      pureCircuits.assertSanctionScreeningPresentationSatisfiesRequest(
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

  it("supports the full compliance gate profile", () => {
    const fixture = createSanctionScreeningFixture();

    expect(() =>
      pureCircuits.assertSanctionScreeningPresentationSatisfiesRequest(
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
      pureCircuits.assertSanctionScreeningResultPass(
        fixture.credential,
        fixture.presentation,
      ),
    ).not.toThrow();
    expect(() =>
      pureCircuits.assertSanctionScreeningPepFalse(
        fixture.credential,
        fixture.presentation,
      ),
    ).not.toThrow();
    expect(() =>
      pureCircuits.assertSanctionScreeningFresh(
        fixture.credential,
        fixture.presentation,
        fixture.witness.currentDay,
        fixture.witness.screeningDateDay,
        fixture.witness.screeningDateOpening,
      ),
    ).not.toThrow();
    expect(() =>
      pureCircuits.assertSanctionScreeningNotExpired(
        fixture.credential,
        fixture.witness.currentDay,
      ),
    ).not.toThrow();
  });
});
