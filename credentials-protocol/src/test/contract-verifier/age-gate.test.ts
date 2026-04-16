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

describe("contract-verifier age-gate", () => {
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

  it("verifies age-gate with birth country disclosure required", () => {
    const bus = new MessageBus();
    const verifierChallengeHash = sha256("challenge:verifier:age-gate");
    const holder = issueCredentialViaProtocol(bus);
    const stored = holder.getCredential(0);

    // Set up contract verifier and register credential
    const contractVerifier = new ContractVerifier();
    contractVerifier.issueBirthCredential(
      stored.credential,
      stored.credentialProof,
      holderProfile.signer.publicKey,
    );

    // Get the age-gate request (which requires country disclosure)
    const request = contractVerifier.getAgeGateRequest(
      stored.credential.issuerVerificationMethodRef,
      verifierChallengeHash,
    );
    expect(request.requireBirthCountryDisclosure).toBe(true);

    // Build a presentation that satisfies the request
    const { presentation, presentationProof } =
      holder.buildPresentationForContract(0, request, {
        credentialIndex: 0,
        currentDay,
        birthDateDays: claimWitness.birthDateDays,
        birthDateOpening: claimWitness.birthDateOpening,
        birthCountryCodePadded: claimWitness.birthCountryCodePadded,
        birthCountryCodeOpening: claimWitness.birthCountryCodeOpening,
      });

    // The presentation should have country code disclosed
    expect(presentation.disclosed.revealBirthCountryCode).toBe(true);

    const pkg: ContractPresentationPackage = {
      presentation,
      presentationProof,
      currentDay,
      birthDateDays: claimWitness.birthDateDays,
      birthDateOpening: claimWitness.birthDateOpening,
    };

    // Issue capability - should succeed
    const { capabilityHash } = contractVerifier.issueAgeGateCapability(
      stored.credential,
      stored.credentialProof,
      verifierChallengeHash,
      pkg,
    );
    expect(capabilityHash).toBeDefined();

    const decision = contractVerifier.claimCapability(capabilityHash);
    expect(decision).toBe("approved");
  });

  it("rejects age-gate when credential was not issued through the contract", () => {
    const bus = new MessageBus();
    const verifierChallengeHash = sha256("challenge:verifier:no-issuance");
    const holder = issueCredentialViaProtocol(bus);
    const stored = holder.getCredential(0);

    // Create a contract verifier but DO NOT register the credential
    const contractVerifier = new ContractVerifier();

    // Get the age-gate request
    const request = contractVerifier.getAgeGateRequest(
      stored.credential.issuerVerificationMethodRef,
      verifierChallengeHash,
    );

    // Build a presentation
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

    // The contract should reject because the credential was never issued
    expect(() =>
      contractVerifier.issueAgeGateCapability(
        stored.credential,
        stored.credentialProof,
        verifierChallengeHash,
        pkg,
      ),
    ).toThrow(/Credential was not issued by the demo contract/);
  });
});
