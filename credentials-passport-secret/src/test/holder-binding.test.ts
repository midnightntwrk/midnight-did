import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { pureCircuits } from "../managed/secret-passport-credential/contract/index.js";
import { createSecretPassportCredentialFixture } from "./credential-fixtures.js";

setNetworkId("undeployed");

describe("secret passport credential: holder binding", () => {
  it("binds the issuer proof to the secret passport credential body", () => {
    const fixture = createSecretPassportCredentialFixture();

    expect(() =>
      pureCircuits.assertValidSecretPassportCredential(
        fixture.credential,
        fixture.credentialProof,
      ),
    ).not.toThrow();

    const tamperedCredential = {
      ...fixture.credential,
      issuedAt: fixture.credential.issuedAt + 1n,
    };

    expect(() =>
      pureCircuits.assertValidSecretPassportCredential(
        tamperedCredential,
        fixture.credentialProof,
      ),
    ).toThrow(/Signature verification failed/);
  });

  it("rejects presentation when holder secret does not match", () => {
    const fixture = createSecretPassportCredentialFixture();

    expect(() =>
      pureCircuits.assertSecretPassportPresentationSatisfiesRequest(
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
      pureCircuits.assertSecretPassportPresentationSatisfiesRequest(
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

  it("rejects presentation when verifier challenge does not match", () => {
    const fixture = createSecretPassportCredentialFixture();
    const mismatchedRequest = {
      ...fixture.presentationRequest,
      verifierChallengeHash: new Uint8Array(32).fill(7),
    };

    expect(() =>
      pureCircuits.assertSecretPassportPresentationSatisfiesRequest(
        fixture.credential,
        fixture.credentialProof,
        mismatchedRequest,
        fixture.presentation,
        fixture.witness.holderSecret,
        fixture.witness.holderSecretOpening,
        fixture.witness.holderBindingBlindingFactor,
      ),
    ).toThrow(
      /Blinded holder challenge response does not match the verifier challenge/,
    );
  });

  it("derives a verifier-scoped pseudonym from the hidden holder secret", () => {
    const fixture = createSecretPassportCredentialFixture();

    expect(() =>
      pureCircuits.assertSecretPassportPresentationSatisfiesRequest(
        fixture.credential,
        fixture.credentialProof,
        fixture.presentationRequest,
        fixture.presentation,
        fixture.witness.holderSecret,
        fixture.witness.holderSecretOpening,
        fixture.witness.holderBindingBlindingFactor,
      ),
    ).not.toThrow();

    const mismatchedRequest = {
      ...fixture.presentationRequest,
      verifierDomainHash: new Uint8Array(32).fill(3),
    };

    expect(() =>
      pureCircuits.assertSecretPassportPresentationSatisfiesRequest(
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
