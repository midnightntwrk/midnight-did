import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  containerRuntimeAvailable,
  type ProtocolDidProfile,
  provisionDidProfile,
  StandaloneEnvironment,
} from "../../../../standalone-environment/src/index.js";
import { createSigner, fill, sha256 } from "../helpers/did-provider.js";
import { MessageBus } from "../../transport/message-bus.js";
import { SecretIssuerAgent } from "../../agents/secret-issuer-agent.js";
import { SecretHolderAgent } from "../../agents/secret-holder-agent.js";
import {
  VerifierAgent,
  type SecretSimulatorWitness,
} from "../../agents/verifier-agent.js";
import type { DIDProfile } from "../../agents/types.js";

const canRun = await containerRuntimeAvailable();
const describeIntegration = canRun ? describe : describe.skip;

const toDIDProfile = (
  profile: ProtocolDidProfile,
  secretKey: bigint,
): DIDProfile => ({
  role: profile.role,
  label: profile.role,
  signer: {
    ...createSigner(profile.role, secretKey),
    verificationMethodRef: profile.verificationMethodRefValue,
  },
});

describeIntegration("secret-holder lifecycle with real Midnight DIDs", () => {
  const env = new StandaloneEnvironment("credentials-secret");
  let issuerProfile: ProtocolDidProfile;
  const verifierSecretKey = 555555555n;

  beforeAll(async () => {
    setNetworkId("undeployed");
    await env.start();
    issuerProfile = await provisionDidProfile(
      env.providers,
      "issuer",
      createSigner("issuer", 123456789n),
      "secret-holder",
    );
    await env.waitForWalletSync();
  }, 600_000);

  afterAll(async () => {
    await env.shutdown();
  }, 300_000);

  it(
    "issues a secret credential and verifies with pseudonym using real issuer DID",
    () => {
      const bus = new MessageBus();
      const issuer = new SecretIssuerAgent(
        toDIDProfile(issuerProfile, 123456789n),
        bus,
      );
      const holder = new SecretHolderAgent(
        {
          label: "alice",
          holderSecret: fill(11),
          holderSecretOpening: fill(13),
        },
        bus,
      );

      const verifierProfile: DIDProfile = {
        role: "verifier",
        label: "verifier",
        signer: createSigner("verifier", verifierSecretKey),
      };
      const verifier = new VerifierAgent(verifierProfile, bus);

      // Issuance via protocol
      issuer.createAndSendOffer("alice");
      holder.receiveOfferAndSendRequest(bus.receive("alice")!);
      issuer.receiveRequestAndIssueCredential(
        bus.receive(issuerProfile.role)!,
        {
          subjectId: fill(1),
          subjectOpening: fill(2),
          legalNamePadded: fill(3),
          legalNameOpening: fill(4),
          birthDateDays: 3650n,
          birthDateOpening: fill(5),
          birthCountryCodePadded: fill(6),
          birthCountryCodeOpening: fill(7),
          issuedAt: 10_000n,
          expiresAt: 20_000n,
        },
      );
      holder.receiveCredentialResult(bus.receive("alice")!);

      expect(holder.credentialCount).toBe(1);

      // Verify credential issuer is bound to real DID
      const stored = holder.getCredential(0);
      expect(stored.credential.issuerVerificationMethodRef).toEqual(
        issuerProfile.verificationMethodRefValue,
      );

      // Presentation with pseudonym
      const verifierDomainHash = sha256("verifier-domain:test");
      verifier.createAndSendSecretPresentationRequest("alice", {
        issuerVerificationMethodRef: issuerProfile.verificationMethodRefValue,
        requireSubjectIdCommitmentDisclosure: false,
        requireBirthCountryDisclosure: false,
        requireVerifierScopedPseudonym: true,
        verifierDomainHash,
        requireAgeOverThreshold: true,
        requestedAgeThresholdYears: 18,
      });

      const request = bus.receive("alice")!;
      holder.receiveRequestAndSendPresentation(request, {
        credentialIndex: 0,
        currentDay: 12775n,
        birthDateDays: 3650n,
        birthDateOpening: fill(5),
        birthCountryCodePadded: fill(6),
        birthCountryCodeOpening: fill(7),
      });

      const submission = bus.receive("verifier")!;
      const { holderSecret, holderSecretOpening } = holder.secretWitness;
      const simulatorWitness: SecretSimulatorWitness = {
        request: request.body as never,
        currentDay: 12775n,
        birthDateDays: 3650n,
        birthDateOpening: fill(5),
        holderSecret,
        holderSecretOpening,
        holderBindingBlindingFactor:
          stored.holderBindingBlindingFactor,
      };

      const result = verifier.receiveSecretSubmissionAndEvaluate(
        submission,
        simulatorWitness,
      );
      expect(result.approved).toBe(true);
      expect(result.pseudonym).toBeDefined();
    },
    600_000,
  );
});
