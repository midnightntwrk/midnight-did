import {
  containerRuntimeAvailable,
  type ProtocolDidProfile,
  provisionDidProfile,
  StandaloneEnvironment,
  verifierChallengeForProfile,
} from "@midnight-ntwrk/midnight-did-standalone-environment";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { pureCircuits } from "../../managed/passport-credential/contract/index.js";
import {
  createPassportCredentialProtocolFixtureForParticipants,
  createSigner,
  withVerificationMethodRef,
} from "../credential-fixtures.js";

const canRun = await containerRuntimeAvailable();
const describeIntegration = canRun ? describe : describe.skip;

describeIntegration("passport credential standalone integration", () => {
  const env = new StandaloneEnvironment("credentials-passport-explicit");
  let issuerProfile: ProtocolDidProfile;
  let holderProfile: ProtocolDidProfile;
  let verifierProfile: ProtocolDidProfile;

  beforeAll(async () => {
    setNetworkId("undeployed");
    await env.start();
    issuerProfile = await provisionDidProfile(
      env.providers,
      "issuer",
      createSigner("issuer", 123456789n),
      "passport-explicit",
    );
    holderProfile = await provisionDidProfile(
      env.providers,
      "holder",
      createSigner("holder", 987654321n),
      "passport-explicit",
    );
    verifierProfile = await provisionDidProfile(
      env.providers,
      "verifier",
      createSigner("verifier", 555555555n),
      "passport-explicit",
    );
    await env.waitForWalletSync();
  }, 600_000);

  afterAll(async () => {
    await env.shutdown();
  }, 300_000);

  it("binds issuer and holder to real Midnight DIDs and validates the explicit passport VC/VP flow", () => {
    const issuerSigner = withVerificationMethodRef(
      createSigner("issuer", 123456789n),
      issuerProfile.verificationMethodRefValue,
    );
    const holderSigner = withVerificationMethodRef(
      createSigner("holder", 987654321n),
      holderProfile.verificationMethodRefValue,
    );
    const fixture = createPassportCredentialProtocolFixtureForParticipants(
      issuerSigner,
      holderSigner,
      verifierChallengeForProfile(verifierProfile.didString, "passport"),
    );

    expect(fixture.credential.issuerVerificationMethodRef).toEqual(
      issuerProfile.verificationMethodRefValue,
    );
    expect(
      fixture.credential.holderBinding.holderVerificationMethodRef,
    ).toEqual(holderProfile.verificationMethodRefValue);

    expect(() =>
      pureCircuits.assertValidPassportCredentialIssuanceOffer(
        fixture.issuanceOffer,
      ),
    ).not.toThrow();
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
    expect(() =>
      pureCircuits.assertValidPassportCredentialVerificationRequestMessage(
        fixture.verificationRequest,
      ),
    ).not.toThrow();
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
    expect(() =>
      pureCircuits.assertValidPassportCredential(
        fixture.credential,
        fixture.credentialProof,
      ),
    ).not.toThrow();
    expect(() =>
      pureCircuits.assertValidPassportCredentialPresentation(
        fixture.credential,
        fixture.credentialProof,
        fixture.presentation,
        fixture.presentationProof,
      ),
    ).not.toThrow();
    expect(() =>
      pureCircuits.assertPassportPresentationSatisfiesRequest(
        fixture.credential,
        fixture.presentationRequest,
        fixture.presentation,
        fixture.presentationProof,
      ),
    ).not.toThrow();
    expect(() =>
      pureCircuits.assertValidPassportCredentialAgePredicate(
        fixture.credential,
        fixture.presentation,
        fixture.witness.currentDay,
        fixture.witness.birthDateDays,
        fixture.witness.birthDateOpening,
      ),
    ).not.toThrow();
    expect(() =>
      pureCircuits.assertPassportNotExpired(
        fixture.credential,
        fixture.witness.currentDay,
      ),
    ).not.toThrow();
  }, 600_000);
});
