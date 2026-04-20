import { createHash } from "node:crypto";

import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  containerRuntimeAvailable,
  type ProtocolDidProfile,
  provisionDidProfile,
  StandaloneEnvironment,
  verifierChallengeForProfile,
} from "../../../../standalone-environment/src/index.js";
import { pureCircuits } from "../../managed/secret-passport-credential/contract/index.js";
import {
  createSecretPassportCredentialFixture,
  createSigner,
} from "../credential-fixtures.js";

const canRun = await containerRuntimeAvailable();
const describeIntegration = canRun ? describe : describe.skip;

const sha256 = (value: string): Uint8Array =>
  new Uint8Array(createHash("sha256").update(value).digest());

describeIntegration("secret passport credential standalone integration", () => {
  const env = new StandaloneEnvironment("credentials-passport-secret");
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
      "passport-secret",
    );
    holderProfile = await provisionDidProfile(
      env.providers,
      "holder",
      createSigner("holder", 987654321n),
      "passport-secret",
    );
    verifierProfile = await provisionDidProfile(
      env.providers,
      "verifier",
      createSigner("verifier", 555555555n),
      "passport-secret",
    );
    await env.waitForWalletSync();
  }, 600_000);

  afterAll(async () => {
    await env.shutdown();
  }, 300_000);

  it("binds the issuer to a real Midnight DID and validates the secret-holder passport VC/VP flow", () => {
    const fixture = createSecretPassportCredentialFixture({
      issuerLabel: "issuer",
      issuerSecretKey: 123456789n,
      issuerVerificationMethodRef: issuerProfile.verificationMethodRefValue,
      verifierChallengeHash: verifierChallengeForProfile(
        verifierProfile.didString,
        "passport-secret-request",
      ),
      verifierDomainHash: verifierChallengeForProfile(
        verifierProfile.didString,
        "passport-secret-domain",
      ),
      holderSecret: sha256(`holder-secret:${holderProfile.didString}`),
      holderSecretOpening: sha256(
        `holder-secret-opening:${holderProfile.didString}`,
      ),
      holderBindingBlindingFactor: sha256(
        `holder-secret-blinding:${holderProfile.didString}`,
      ),
    });

    expect(fixture.credential.issuerVerificationMethodRef).toEqual(
      issuerProfile.verificationMethodRefValue,
    );
    expect(fixture.presentationRequest.verifierChallengeHash).toEqual(
      verifierChallengeForProfile(
        verifierProfile.didString,
        "passport-secret-request",
      ),
    );

    expect(() =>
      pureCircuits.assertValidSecretPassportCredential(
        fixture.credential,
        fixture.credentialProof,
      ),
    ).not.toThrow();
    expect(() =>
      pureCircuits.assertValidSecretPassportCredentialPresentationRequest(
        fixture.presentationRequest,
      ),
    ).not.toThrow();
    expect(() =>
      pureCircuits.assertValidSecretPassportCredentialPresentation(
        fixture.credential,
        fixture.credentialProof,
        fixture.presentation,
      ),
    ).not.toThrow();
    expect(() =>
      pureCircuits.assertValidSecretPassportCredentialVerificationRequestMessage(
        fixture.verificationRequest,
      ),
    ).not.toThrow();
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
      pureCircuits.assertValidSecretPassportCredentialAgePredicate(
        fixture.credential,
        fixture.presentation,
        fixture.witness.currentDay,
        fixture.witness.birthDateDays,
        fixture.witness.birthDateOpening,
      ),
    ).not.toThrow();
    expect(() =>
      pureCircuits.assertSecretPassportNotExpired(
        fixture.credential,
        fixture.witness.currentDay,
      ),
    ).not.toThrow();
  }, 600_000);
});
