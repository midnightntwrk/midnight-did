import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { createSanctionScreeningFixture } from "../fixtures/credential-fixtures.js";
import { pureCircuits } from "../managed/sanction-screening-credential/contract/index.js";

setNetworkId("undeployed");

describe("sanction screening credential: holder binding", () => {
  it("binds the issuer proof to the compliance credential body", () => {
    const fixture = createSanctionScreeningFixture();

    expect(() =>
      pureCircuits.assertValidSanctionScreeningCredential(
        fixture.credential,
        fixture.credentialProof,
      ),
    ).not.toThrow();

    const tamperedCredential = {
      ...fixture.credential,
      issuedAt: fixture.credential.issuedAt + 1n,
    };

    expect(() =>
      pureCircuits.assertValidSanctionScreeningCredential(
        tamperedCredential,
        fixture.credentialProof,
      ),
    ).toThrow(/Signature verification failed/);
  });

  it("rejects a presentation when the hidden holder secret does not match", () => {
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
      pureCircuits.assertSanctionScreeningPresentationSatisfiesRequest(
        fixture.credential,
        fixture.credentialProof,
        fixture.presentationRequest,
        fixture.presentation,
        new Uint8Array(32).fill(5),
        fixture.witness.holderSecretOpening,
        fixture.witness.holderBindingBlindingFactor,
      ),
    ).toThrow(
      /Blinded holder commitment does not match the hidden holder secret witness/,
    );
  });

  it("derives a verifier-scoped pseudonym from the hidden holder secret", () => {
    const fixture = createSanctionScreeningFixture();
    const mismatchedRequest = {
      ...fixture.presentationRequest,
      verifierDomainHash: new Uint8Array(32).fill(3),
    };

    expect(() =>
      pureCircuits.assertSanctionScreeningPresentationSatisfiesRequest(
        fixture.credential,
        fixture.credentialProof,
        mismatchedRequest,
        fixture.presentation,
        fixture.witness.holderSecret,
        fixture.witness.holderSecretOpening,
        fixture.witness.holderBindingBlindingFactor,
      ),
    ).toThrow(
      /Verifier-scoped pseudonym does not match the holder secret and verifier domain/,
    );
  });
});
