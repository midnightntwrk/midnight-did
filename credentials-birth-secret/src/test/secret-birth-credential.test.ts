import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { pureCircuits } from "../managed/secret-birth-credential/contract/index.js";
import { createSecretBirthCredentialFixture } from "./credential-fixtures.js";

setNetworkId("undeployed");

describe("secret holder-binding birth credential specialization", () => {
  it("binds the issuer proof to the secret-bound credential body", () => {
    const fixture = createSecretBirthCredentialFixture();

    expect(() =>
      pureCircuits.assertValidSecretBirthCredential(
        fixture.credential,
        fixture.credentialProof,
      ),
    ).not.toThrow();

    const tamperedCredential = {
      ...fixture.credential,
      issuedAt: fixture.credential.issuedAt + 1n,
    };

    expect(() =>
      pureCircuits.assertValidSecretBirthCredential(
        tamperedCredential,
        fixture.credentialProof,
      ),
    ).toThrow(/Signature verification failed/);
  });

  it("binds the presentation to the hidden holder secret", () => {
    const fixture = createSecretBirthCredentialFixture();

    expect(() =>
      pureCircuits.assertSecretBirthPresentationSatisfiesRequest(
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
      pureCircuits.assertSecretBirthPresentationSatisfiesRequest(
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

  it("rejects a mismatched verifier challenge for the secret holder binding", () => {
    const fixture = createSecretBirthCredentialFixture();
    const mismatchedRequest = {
      ...fixture.presentationRequest,
      verifierChallengeHash: new Uint8Array(32).fill(7),
    };

    expect(() =>
      pureCircuits.assertSecretBirthPresentationSatisfiesRequest(
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
    const fixture = createSecretBirthCredentialFixture();

    expect(() =>
      pureCircuits.assertSecretBirthPresentationSatisfiesRequest(
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
      pureCircuits.assertSecretBirthPresentationSatisfiesRequest(
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

  it("checks the private age witness against the committed birth date", () => {
    const fixture = createSecretBirthCredentialFixture();

    expect(() =>
      pureCircuits.assertValidSecretBirthCredentialAgePredicate(
        fixture.credential,
        fixture.presentation,
        fixture.witness.currentDay,
        fixture.witness.birthDateDays,
        fixture.witness.birthDateOpening,
      ),
    ).not.toThrow();
  });

  describe("capability composition use cases", () => {
    it("supports a minimal privacy-preserving birth certificate flow with hidden holder binding only", () => {
      const fixture = createSecretBirthCredentialFixture();
      const request = {
        ...fixture.presentationRequest,
        requireBirthCountryDisclosure: false,
        requireVerifierScopedPseudonym: false,
        requireAgeOverThreshold: false,
        requestedAgeThresholdYears: 0n,
      };
      const presentation = {
        ...fixture.presentation,
        disclosed: {
          ...fixture.presentation.disclosed,
          revealBirthCountryCode: false,
          revealVerifierScopedPseudonym: false,
          proveAgeOverThreshold: false,
          ageThresholdYears: 0n,
        },
      };

      expect(() =>
        pureCircuits.assertSecretBirthPresentationSatisfiesRequest(
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

    it("supports a privacy-preserving flow with hidden holder binding and an age predicate", () => {
      const fixture = createSecretBirthCredentialFixture();
      const request = {
        ...fixture.presentationRequest,
        requireBirthCountryDisclosure: false,
        requireVerifierScopedPseudonym: false,
      };
      const presentation = {
        ...fixture.presentation,
        disclosed: {
          ...fixture.presentation.disclosed,
          revealBirthCountryCode: false,
          revealVerifierScopedPseudonym: false,
        },
      };

      expect(() =>
        pureCircuits.assertSecretBirthPresentationSatisfiesRequest(
          fixture.credential,
          fixture.credentialProof,
          request,
          presentation,
          fixture.witness.holderSecret,
          fixture.witness.holderSecretOpening,
          fixture.witness.holderBindingBlindingFactor,
        ),
      ).not.toThrow();

      expect(() =>
        pureCircuits.assertValidSecretBirthCredentialAgePredicate(
          fixture.credential,
          presentation,
          fixture.witness.currentDay,
          fixture.witness.birthDateDays,
          fixture.witness.birthDateOpening,
        ),
      ).not.toThrow();
    });

    it("supports the most advanced current birth certificate flow with blinded holder binding, verifier-domain pseudonym, selective disclosure, and age predicate", () => {
      const fixture = createSecretBirthCredentialFixture();

      expect(() =>
        pureCircuits.assertSecretBirthPresentationSatisfiesRequest(
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
        pureCircuits.assertValidSecretBirthCredentialAgePredicate(
          fixture.credential,
          fixture.presentation,
          fixture.witness.currentDay,
          fixture.witness.birthDateDays,
          fixture.witness.birthDateOpening,
        ),
      ).not.toThrow();
    });
  });
});
