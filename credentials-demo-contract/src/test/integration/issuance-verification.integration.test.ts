import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { afterAll,beforeAll, describe, expect, it } from "vitest";

import { pureCircuits } from "../../../../credentials-birth/src/managed/birth-credential/contract/index.js";
import {
  createBirthCredentialProtocolFixtureForParticipants,
  createSigner,
  withVerificationMethodRef,
} from "../../../../credentials-birth/src/test/credential-fixtures.js";
import {
  containerRuntimeAvailable,
  type ProtocolDidProfile,
  provisionDidProfile,
  StandaloneEnvironment,
  verifierChallengeForProfile,
} from "../../../../standalone-environment/src/index.js";
import { CredentialsDemoSimulator } from "../../simulator.js";

const canRunContainers = await containerRuntimeAvailable();
const describeIntegration = canRunContainers ? describe : describe.skip;

describeIntegration("credentials protocol standalone integration", () => {
  const environment = new StandaloneEnvironment("credentials-demo-contract");
  let issuerProfile: ProtocolDidProfile;
  let holderProfile: ProtocolDidProfile;
  let verifierProfile: ProtocolDidProfile;

  beforeAll(async () => {
    setNetworkId("undeployed");
    await environment.start();
    issuerProfile = await provisionDidProfile(
      environment.providers,
      "issuer",
      createSigner("issuer", 123456789n),
      "credentials-demo-contract",
    );
    holderProfile = await provisionDidProfile(
      environment.providers,
      "holder",
      createSigner("holder", 987654321n),
      "credentials-demo-contract",
    );
    verifierProfile = await provisionDidProfile(
      environment.providers,
      "verifier",
      createSigner("verifier", 555555555n),
      "credentials-demo-contract",
    );
    await environment.waitForWalletSync();
  }, 1000 * 60 * 10);

  afterAll(async () => {
    await environment.shutdown();
  }, 1000 * 60 * 5);

  it(
    "provisions real issuer, holder, and verifier Midnight DIDs and runs the issuance/verification protocol on top of them",
    async () => {
      expect(issuerProfile.didString).toMatch(
        new RegExp(`^did:midnight:${environment.network}:`),
      );
      expect(holderProfile.didString).toMatch(
        new RegExp(`^did:midnight:${environment.network}:`),
      );
      expect(verifierProfile.didString).toMatch(
        new RegExp(`^did:midnight:${environment.network}:`),
      );

      const issuerSigner = withVerificationMethodRef(
        createSigner("issuer", 123456789n),
        issuerProfile.verificationMethodRefValue,
      );
      const holderSigner = withVerificationMethodRef(
        createSigner("holder", 987654321n),
        holderProfile.verificationMethodRefValue,
      );
      const protocolFixture = createBirthCredentialProtocolFixtureForParticipants(
        issuerSigner,
        holderSigner,
        verifierChallengeForProfile(verifierProfile.didString, "age-gate"),
      );

      pureCircuits.assertValidBirthCredentialIssuanceOffer(
        protocolFixture.issuanceOffer,
      );
      pureCircuits.assertBirthCredentialIssuanceRequestMatchesOffer(
        protocolFixture.issuanceOffer,
        protocolFixture.issuanceRequest,
      );
      pureCircuits.assertBirthCredentialIssuanceResultMatchesRequest(
        protocolFixture.issuanceRequest,
        protocolFixture.issuanceResult,
      );
      pureCircuits.assertBirthCredentialVerificationSubmissionMatchesRequest(
        protocolFixture.verificationRequest,
        protocolFixture.verificationSubmission,
      );
      pureCircuits.assertBirthCredentialVerificationResultMatchesSubmission(
        protocolFixture.verificationSubmission,
        protocolFixture.verificationResult,
      );

      const simulator = new CredentialsDemoSimulator();
      simulator.issueBirthCredential(
        protocolFixture.credential,
        protocolFixture.credentialProof,
        protocolFixture.holder.publicKey,
      );
      simulator.setAgeWitness(
        protocolFixture.witness.birthDateDays,
        protocolFixture.witness.birthDateOpening,
      );

      const accessCapability = simulator.issueAgeGateCapability(
        protocolFixture.credential,
        protocolFixture.credentialProof,
        protocolFixture.presentation,
        protocolFixture.presentationProof,
        protocolFixture.verificationRequest.verifierChallengeHash,
        protocolFixture.witness.currentDay,
      );
      const state = simulator.getLedger();

      expect(accessCapability).toBeInstanceOf(Uint8Array);
      expect(state.issuedCredentialCount).toEqual(1n);
      expect(state.verifiedPresentationCount).toEqual(1n);
      expect(state.lastVerifiedRequestChallenge).toEqual(
        protocolFixture.verificationRequest.verifierChallengeHash,
      );
      expect(state.lastVerifiedCredentialRoot).toEqual(
        pureCircuits.birthCredentialBodyRoot(protocolFixture.credential),
      );
      expect(protocolFixture.credential.issuerVerificationMethodRef).toEqual(
        issuerProfile.verificationMethodRefValue,
      );
      expect(
        protocolFixture.presentation.holderBinding.holderVerificationMethodRef,
      ).toEqual(holderProfile.verificationMethodRefValue);
    },
    1000 * 60 * 10,
  );
});
