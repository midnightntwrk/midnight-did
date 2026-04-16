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

describe("explicit-holder full lifecycle", () => {
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
   * Run the full protocol issuance flow: Issuer -> MessageBus -> Holder.
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

  it("completes issue -> present -> verify -> capability -> claim lifecycle", () => {
    const bus = new MessageBus();
    const verifierChallengeHash = sha256("challenge:verifier:lifecycle");

    // Step 1: Issuance via protocol (IssuerAgent -> MessageBus -> HolderAgent)
    const holder = issueCredentialViaProtocol(bus);
    expect(holder.credentialCount).toBe(1);

    const stored = holder.getCredential(0);

    // Step 2: Contract issuance - register the credential with the contract verifier
    const contractVerifier = new ContractVerifier();
    contractVerifier.issueBirthCredential(
      stored.credential,
      stored.credentialProof,
      holderProfile.signer.publicKey,
    );

    // Step 3: Read contract policy - get the age-gate request
    const ageGateRequest = contractVerifier.getAgeGateRequest(
      stored.credential.issuerVerificationMethodRef,
      verifierChallengeHash,
    );
    expect(ageGateRequest.requireBirthCountryDisclosure).toBe(true);
    expect(ageGateRequest.requireAgeOverThreshold).toBe(true);
    expect(ageGateRequest.requestedAgeThresholdYears).toBe(18n);

    // Step 4: Build presentation using the contract's request
    const { presentation, presentationProof } =
      holder.buildPresentationForContract(0, ageGateRequest, {
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

    // Step 5: Issue capability - submit presentation to contract verifier
    const { capabilityHash } = contractVerifier.issueAgeGateCapability(
      stored.credential,
      stored.credentialProof,
      verifierChallengeHash,
      pkg,
    );
    expect(capabilityHash).toBeDefined();
    expect(capabilityHash.length).toBe(32);

    // Step 6: Claim capability - first claim returns "approved"
    const firstClaim = contractVerifier.claimCapability(capabilityHash);
    expect(firstClaim).toBe("approved");

    // Step 7: Re-claim - second claim returns "alreadyConsumed"
    const secondClaim = contractVerifier.claimCapability(capabilityHash);
    expect(secondClaim).toBe("alreadyConsumed");
  });
});
