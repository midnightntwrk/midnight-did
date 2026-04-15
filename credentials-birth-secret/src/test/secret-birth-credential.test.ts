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
      ),
    ).toThrow(
      /Holder secret witness does not match the holder-binding commitment/,
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
      ),
    ).toThrow(
      /Holder secret challenge response does not match the verifier challenge/,
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
});
