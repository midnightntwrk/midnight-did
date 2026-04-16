import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  containerRuntimeAvailable,
  type ProtocolDidProfile,
  provisionDidProfile,
  StandaloneEnvironment,
} from "../../../../standalone-environment/src/index.js";
import { ContractVerifier } from "../../agents/contract-verifier.js";
import { HolderAgent } from "../../agents/holder-agent.js";
import { IssuerAgent } from "../../agents/issuer-agent.js";
import type { DIDProfile } from "../../agents/types.js";
import { MessageBus } from "../../transport/message-bus.js";
import { createSigner, fill } from "../helpers/did-provider.js";

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

describeIntegration(
  "contract-verifier lifecycle with real Midnight DIDs",
  () => {
    const env = new StandaloneEnvironment("credentials-contract");
    let issuerProfile: ProtocolDidProfile;
    let holderProfile: ProtocolDidProfile;

    beforeAll(async () => {
      setNetworkId("undeployed");
      await env.start();
      issuerProfile = await provisionDidProfile(
        env.providers,
        "issuer",
        createSigner("issuer", 123456789n),
        "contract-verifier",
      );
      holderProfile = await provisionDidProfile(
        env.providers,
        "holder",
        createSigner("holder", 987654321n),
        "contract-verifier",
      );
      await env.waitForWalletSync();
    }, 600_000);

    afterAll(async () => {
      await env.shutdown();
    }, 300_000);

    it(
      "completes age-gate verification and capability lifecycle with real DIDs",
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
        const contract = new ContractVerifier();

        // Phase 1: Issue credential via protocol
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

        // Verify real DID binding
        const stored = holder.getCredential(0);
        expect(stored.credential.issuerVerificationMethodRef).toEqual(
          issuerProfile.verificationMethodRefValue,
        );

        // Phase 2: Register credential with contract
        contract.issueBirthCredential(
          stored.credential,
          stored.credentialProof,
          toDIDProfile(holderProfile, 987654321n).signer.publicKey,
        );

        // Phase 3: Read contract policy and present
        const ageGateRequest = contract.getAgeGateRequest(
          issuerProfile.verificationMethodRefValue,
        );
        expect(ageGateRequest).toBeDefined();

        const { presentation, presentationProof } =
          holder.buildPresentationForContract(0, ageGateRequest, {
            credentialIndex: 0,
            currentDay: 12775n,
            birthDateDays: 3650n,
            birthDateOpening: fill(5),
            birthCountryCodePadded: fill(6),
            birthCountryCodeOpening: fill(7),
          });

        // Phase 4: Issue capability
        const capabilityResult = contract.issueAgeGateCapability(
          stored.credential,
          stored.credentialProof,
          presentation,
          presentationProof,
          ageGateRequest.verifierChallengeHash,
          12775n,
          3650n,
          fill(5),
        );

        expect(capabilityResult).toBeDefined();

        // Phase 5: Claim capability
        const claimResult = contract.claimCapability(capabilityResult);
        expect(claimResult).toBe("approved");

        // Phase 6: Second claim should be denied
        const secondClaim = contract.claimCapability(capabilityResult);
        expect(secondClaim).toBe("alreadyConsumed");
      },
      600_000,
    );
  },
);
