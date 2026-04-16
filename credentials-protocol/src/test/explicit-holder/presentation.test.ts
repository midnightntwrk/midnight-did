import { describe, it, expect } from "vitest";

import { MessageBus } from "../../transport/message-bus.js";
import { IssuerAgent, type ClaimWitness } from "../../agents/issuer-agent.js";
import {
  HolderAgent,
  type PresentationWitness,
} from "../../agents/holder-agent.js";
import { VerifierAgent } from "../../agents/verifier-agent.js";
import {
  createDIDProfile,
  sha256,
  padText,
} from "../helpers/did-provider.js";

describe("explicit-holder presentation", () => {
  const issuerProfile = createDIDProfile("issuer", "issuer", 123456789n);
  const holderProfile = createDIDProfile("holder", "holder", 987654321n);
  const verifierProfile = createDIDProfile("verifier", "verifier", 555555555n);

  const claimWitness: ClaimWitness = {
    subjectId: sha256("subject:alice"),
    subjectOpening: sha256("opening:subject"),
    legalNamePadded: padText("Alice Example"),
    legalNameOpening: sha256("opening:legal-name"),
    birthDateDays: 3650n, // ~10 years from epoch
    birthDateOpening: sha256("opening:birth-date"),
    birthCountryCodePadded: padText("CAN"),
    birthCountryCodeOpening: sha256("opening:birth-country"),
    issuedAt: 10_000n,
    expiresAt: 20_000n,
  };

  /**
   * Run the full issuance flow and return a holder with one stored credential.
   */
  const issueCredential = (bus: MessageBus): HolderAgent => {
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

  it("completes a presentation flow with selective disclosure and age predicate", () => {
    const bus = new MessageBus();
    const holder = issueCredential(bus);
    const verifier = new VerifierAgent(verifierProfile, bus);

    expect(holder.credentialCount).toBe(1);

    // Step 1: Verifier sends a presentation request to the holder
    verifier.createAndSendPresentationRequest("holder", {
      issuerVerificationMethodRef: issuerProfile.signer.verificationMethodRef,
      requireSubjectIdCommitmentDisclosure: false,
      requireBirthCountryDisclosure: true,
      requireAgeOverThreshold: true,
      requestedAgeThresholdYears: 18,
    });
    expect(bus.pending("holder")).toBe(1);

    // Step 2: Holder receives request and builds presentation
    const request = bus.receive("holder");
    expect(request).toBeDefined();
    expect(request!.type).toBe("presentation:request");

    // Alice is 25 years old: birthDateDays=3650, currentDay = 3650 + 365*25 = 12775
    const presentationWitness: PresentationWitness = {
      credentialIndex: 0,
      currentDay: 3650n + 365n * 25n,
      birthDateDays: claimWitness.birthDateDays,
      birthDateOpening: claimWitness.birthDateOpening,
      birthCountryCodePadded: claimWitness.birthCountryCodePadded,
      birthCountryCodeOpening: claimWitness.birthCountryCodeOpening,
    };

    holder.receiveRequestAndSendPresentation(request!, presentationWitness);
    expect(bus.pending("verifier")).toBe(1);

    // Step 3: Verifier receives submission and evaluates
    const submission = bus.receive("verifier");
    expect(submission).toBeDefined();
    expect(submission!.type).toBe("presentation:submission");

    const result = verifier.receiveSubmissionAndEvaluate(submission!);
    expect(result.approved).toBe(true);
  });

  it("rejects a presentation when the holder does not meet the age threshold", () => {
    const bus = new MessageBus();
    const holder = issueCredential(bus);
    const verifier = new VerifierAgent(verifierProfile, bus);

    // Verifier requires age over 30, but Alice is only 25
    verifier.createAndSendPresentationRequest("holder", {
      issuerVerificationMethodRef: issuerProfile.signer.verificationMethodRef,
      requireSubjectIdCommitmentDisclosure: false,
      requireBirthCountryDisclosure: true,
      requireAgeOverThreshold: true,
      requestedAgeThresholdYears: 30,
    });

    const request = bus.receive("holder")!;

    // Alice is 25 years old: currentDay = 3650 + 365*25 = 12775
    const presentationWitness: PresentationWitness = {
      credentialIndex: 0,
      currentDay: 3650n + 365n * 25n,
      birthDateDays: claimWitness.birthDateDays,
      birthDateOpening: claimWitness.birthDateOpening,
      birthCountryCodePadded: claimWitness.birthCountryCodePadded,
      birthCountryCodeOpening: claimWitness.birthCountryCodeOpening,
    };

    holder.receiveRequestAndSendPresentation(request, presentationWitness);

    const submission = bus.receive("verifier")!;

    // The verifier evaluation should throw because the age predicate fails
    expect(() => verifier.receiveSubmissionAndEvaluate(submission)).toThrow();
  });
});
