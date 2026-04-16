import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect, beforeAll } from "vitest";

import { MessageBus } from "../../transport/message-bus.js";
import { IssuerAgent, type ClaimWitness } from "../../agents/issuer-agent.js";
import { HolderAgent } from "../../agents/holder-agent.js";
import {
  ContractVerifier,
  type ContractPresentationPackage,
} from "../../agents/contract-verifier.js";
import {
  createDIDProfile,
  sha256,
  padText,
} from "../helpers/did-provider.js";

describe("contract-verifier capability-lifecycle", () => {
  beforeAll(() => {
    setNetworkId("undeployed");
  });

  const issuerProfile = createDIDProfile("issuer", "issuer", 123456789n);
  const holderProfile = createDIDProfile("holder", "holder", 987654321n);

  const claimWitness: ClaimWitness = {
    subjectId: sha256("subject:alice"),
    subjectOpening: sha256("opening:subject"),
    legalNamePadded: padText("Alice Example"),
    legalNameOpening: sha256("opening:legal-name"),
    birthDateDays: 3650n,
    birthDateOpening: sha256("opening:birth-date"),
    birthCountryCodePadded: padText("CAN"),
    birthCountryCodeOpening: sha256("opening:birth-country"),
    issuedAt: 10_000n,
    expiresAt: 20_000n,
  };

  const currentDay = 3650n + 365n * 25n; // Alice is 25 years old

  /**
   * Run the full protocol issuance flow and return a holder with one stored credential.
   */
  const issueCredentialViaProtocol = (bus: MessageBus): HolderAgent => {
    const issuer = new IssuerAgent(issuerProfile, bus);
    const holder = new HolderAgent(holderProfile, bus);

    issuer.createAndSendOffer("holder");
    holder.receiveOfferAndSendRequest(bus.receive("holder")!);
    issuer.receiveRequestAndIssueCredential(
      bus.receive("issuer")!,
      claimWitness,
    );
    holder.receiveCredentialResult(bus.receive("holder")!);

    return holder;
  };

  /**
   * Set up a contract verifier with a registered credential and issue one capability.
   */
  const setupAndIssueCapability = (
    holder: HolderAgent,
    verifierChallengeHash: Uint8Array,
  ): { contractVerifier: ContractVerifier; capabilityHash: Uint8Array } => {
    const stored = holder.getCredential(0);
    const contractVerifier = new ContractVerifier();

    contractVerifier.issueBirthCredential(
      stored.credential,
      stored.credentialProof,
      holderProfile.signer.publicKey,
    );

    const request = contractVerifier.getAgeGateRequest(
      stored.credential.issuerVerificationMethodRef,
      verifierChallengeHash,
    );

    const { presentation, presentationProof } =
      holder.buildPresentationForContract(0, request, {
        credentialIndex: 0,
        currentDay,
        birthDateDays: claimWitness.birthDateDays,
        birthDateOpening: claimWitness.birthDateOpening,
        birthCountryCodePadded: claimWitness.birthCountryCodePadded,
        birthCountryCodeOpening: claimWitness.birthCountryCodeOpening,
      });

    const pkg: ContractPresentationPackage = {
      presentation,
      presentationProof,
      currentDay,
      birthDateDays: claimWitness.birthDateDays,
      birthDateOpening: claimWitness.birthDateOpening,
    };

    const { capabilityHash } = contractVerifier.issueAgeGateCapability(
      stored.credential,
      stored.credentialProof,
      verifierChallengeHash,
      pkg,
    );

    return { contractVerifier, capabilityHash };
  };

  it("returns unknownCapability for unissued capability hash", () => {
    const bus = new MessageBus();
    const holder = issueCredentialViaProtocol(bus);

    // Set up a contract verifier (we need at least to register the credential)
    const contractVerifier = new ContractVerifier();
    const stored = holder.getCredential(0);
    contractVerifier.issueBirthCredential(
      stored.credential,
      stored.credentialProof,
      holderProfile.signer.publicKey,
    );

    // Claim with a random hash that was never issued
    const randomHash = new Uint8Array(32).fill(99);
    const decision = contractVerifier.claimCapability(randomHash);
    expect(decision).toBe("unknownCapability");
  });

  it("supports multiple independent capabilities", () => {
    const bus = new MessageBus();
    const holder = issueCredentialViaProtocol(bus);
    const stored = holder.getCredential(0);

    // Create a single contract verifier for both capabilities
    const contractVerifier = new ContractVerifier();
    contractVerifier.issueBirthCredential(
      stored.credential,
      stored.credentialProof,
      holderProfile.signer.publicKey,
    );

    // Issue first capability with one challenge
    const challenge1 = sha256("challenge:verifier:cap-1");
    const request1 = contractVerifier.getAgeGateRequest(
      stored.credential.issuerVerificationMethodRef,
      challenge1,
    );

    const { presentation: pres1, presentationProof: proof1 } =
      holder.buildPresentationForContract(0, request1, {
        credentialIndex: 0,
        currentDay,
        birthDateDays: claimWitness.birthDateDays,
        birthDateOpening: claimWitness.birthDateOpening,
        birthCountryCodePadded: claimWitness.birthCountryCodePadded,
        birthCountryCodeOpening: claimWitness.birthCountryCodeOpening,
      });

    const { capabilityHash: cap1 } = contractVerifier.issueAgeGateCapability(
      stored.credential,
      stored.credentialProof,
      challenge1,
      {
        presentation: pres1,
        presentationProof: proof1,
        currentDay,
        birthDateDays: claimWitness.birthDateDays,
        birthDateOpening: claimWitness.birthDateOpening,
      },
    );

    // Issue second capability with a different challenge
    const challenge2 = sha256("challenge:verifier:cap-2");
    const request2 = contractVerifier.getAgeGateRequest(
      stored.credential.issuerVerificationMethodRef,
      challenge2,
    );

    const { presentation: pres2, presentationProof: proof2 } =
      holder.buildPresentationForContract(0, request2, {
        credentialIndex: 0,
        currentDay,
        birthDateDays: claimWitness.birthDateDays,
        birthDateOpening: claimWitness.birthDateOpening,
        birthCountryCodePadded: claimWitness.birthCountryCodePadded,
        birthCountryCodeOpening: claimWitness.birthCountryCodeOpening,
      });

    const { capabilityHash: cap2 } = contractVerifier.issueAgeGateCapability(
      stored.credential,
      stored.credentialProof,
      challenge2,
      {
        presentation: pres2,
        presentationProof: proof2,
        currentDay,
        birthDateDays: claimWitness.birthDateDays,
        birthDateOpening: claimWitness.birthDateOpening,
      },
    );

    // The two capabilities should be different
    expect(cap1).not.toEqual(cap2);

    // Claim first capability independently
    const decision1 = contractVerifier.claimCapability(cap1);
    expect(decision1).toBe("approved");

    // Second capability should still be claimable
    const decision2 = contractVerifier.claimCapability(cap2);
    expect(decision2).toBe("approved");

    // Both should now be consumed
    expect(contractVerifier.claimCapability(cap1)).toBe("alreadyConsumed");
    expect(contractVerifier.claimCapability(cap2)).toBe("alreadyConsumed");
  });
});
