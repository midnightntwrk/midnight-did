import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  containerRuntimeAvailable,
  type ProtocolDidProfile,
  provisionDidProfile,
  StandaloneEnvironment,
} from "../../../../standalone-environment/src/index.js";
import { createSigner, fill } from "../helpers/did-provider.js";
import { MessageBus } from "../../transport/message-bus.js";
import { IssuerAgent } from "../../agents/issuer-agent.js";
import { HolderAgent } from "../../agents/holder-agent.js";
import { VerifierAgent, type SimulatorWitness } from "../../agents/verifier-agent.js";
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

describeIntegration("explicit-holder lifecycle with real Midnight DIDs", () => {
  const env = new StandaloneEnvironment("credentials-explicit");
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
      "explicit-holder",
    );
    holderProfile = await provisionDidProfile(
      env.providers,
      "holder",
      createSigner("holder", 987654321n),
      "explicit-holder",
    );
    verifierProfile = await provisionDidProfile(
      env.providers,
      "verifier",
      createSigner("verifier", 555555555n),
      "explicit-holder",
    );
    await env.waitForWalletSync();
  }, 600_000);

  afterAll(async () => {
    await env.shutdown();
  }, 300_000);

  it(
    "issues a credential and verifies a presentation with real DIDs and age predicate",
    () => {
      const bus = new MessageBus();
      const issuer = new IssuerAgent(
        toDIDProfile(issuerProfile, 123456789n),
        bus,
      );
      const holder = new HolderAgent(
        toDIDProfile(holderProfile, 987654321n),
        bus,
      );
      const verifier = new VerifierAgent(
        toDIDProfile(verifierProfile, 555555555n),
        bus,
      );

      // Issuance via protocol
      issuer.createAndSendOffer(holderProfile.role);
      holder.receiveOfferAndSendRequest(bus.receive(holderProfile.role)!);
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
      holder.receiveCredentialResult(bus.receive(holderProfile.role)!);

      expect(holder.credentialCount).toBe(1);

      // Verify credential is bound to real DIDs
      const stored = holder.getCredential(0);
      expect(stored.credential.holderBinding.holderVerificationMethodRef).toEqual(
        holderProfile.verificationMethodRefValue,
      );
      expect(stored.credential.issuerVerificationMethodRef).toEqual(
        issuerProfile.verificationMethodRefValue,
      );

      // Presentation with age predicate
      verifier.createAndSendPresentationRequest(holderProfile.role, {
        issuerVerificationMethodRef: issuerProfile.verificationMethodRefValue,
        requireSubjectIdCommitmentDisclosure: false,
        requireBirthCountryDisclosure: true,
        requireAgeOverThreshold: true,
        requestedAgeThresholdYears: 18,
      });

      const request = bus.receive(holderProfile.role)!;
      holder.receiveRequestAndSendPresentation(request, {
        credentialIndex: 0,
        currentDay: 12775n,
        birthDateDays: 3650n,
        birthDateOpening: fill(5),
        birthCountryCodePadded: fill(6),
        birthCountryCodeOpening: fill(7),
      });

      const submission = bus.receive(verifierProfile.role)!;
      const simulatorWitness: SimulatorWitness = {
        request: request.body as never,
        currentDay: 12775n,
        birthDateDays: 3650n,
        birthDateOpening: fill(5),
      };

      const result = verifier.receiveSubmissionAndEvaluate(
        submission,
        simulatorWitness,
      );
      expect(result.approved).toBe(true);
    },
    600_000,
  );
});
