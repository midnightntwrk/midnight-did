import { describe, expect,it } from "vitest";

import {
  type BirthCredentialIssuanceOffer,
  type BirthCredentialIssuanceRequest,
  type BirthCredentialIssuanceResult,
  type BirthCredentialVerificationRequest,
  type BirthCredentialVerificationSubmission,
  pureCircuits,
} from "../../../../credentials-birth/src/managed/birth-credential/contract/index.js";
import {
  HolderAgent,
  type PresentationWitness,
} from "../../agents/holder-agent.js";
import { type ClaimWitness,IssuerAgent } from "../../agents/issuer-agent.js";
import { type SimulatorWitness,VerifierAgent } from "../../agents/verifier-agent.js";
import { MessageBus } from "../../transport/message-bus.js";
import {
  createDIDProfile,
  padText,
  sha256,
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
    const offer = bus.receive("holder")!;
    const offerBody = offer.body as BirthCredentialIssuanceOffer;
    pureCircuits.assertValidBirthCredentialIssuanceOffer(offerBody);
    holder.receiveOfferAndSendRequest(offer);
    const request = bus.receive("issuer")!;
    const requestBody = request.body as BirthCredentialIssuanceRequest;
    pureCircuits.assertValidBirthCredentialIssuanceRequest(requestBody);
    pureCircuits.assertBirthCredentialIssuanceRequestMatchesOffer(
      offerBody,
      requestBody,
    );
    issuer.receiveRequestAndIssueCredential(
      request,
      claimWitness,
    );
    const result = bus.receive("holder")!;
    const resultBody = result.body as BirthCredentialIssuanceResult;
    pureCircuits.assertValidBirthCredentialIssuanceResult(resultBody);
    pureCircuits.assertBirthCredentialIssuanceResultMatchesRequest(
      requestBody,
      resultBody,
    );
    holder.receiveCredentialResult(result);

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
    const requestMessage = bus.receive("holder");
    expect(requestMessage).toBeDefined();
    expect(requestMessage!.type).toBe("presentation:request");
    const requestBody = requestMessage!.body as BirthCredentialVerificationRequest;
    pureCircuits.assertValidBirthCredentialVerificationRequestMessage(
      requestBody,
    );

    // Capture the request for the simulator witness (verifier knows this in a real protocol)
    const presentationRequest = requestBody;

    // Alice is 25 years old: birthDateDays=3650, currentDay = 3650 + 365*25 = 12775
    const presentationWitness: PresentationWitness = {
      credentialIndex: 0,
      currentDay: 3650n + 365n * 25n,
      birthDateDays: claimWitness.birthDateDays,
      birthDateOpening: claimWitness.birthDateOpening,
      birthCountryCodePadded: claimWitness.birthCountryCodePadded,
      birthCountryCodeOpening: claimWitness.birthCountryCodeOpening,
    };

    holder.receiveRequestAndSendPresentation(requestMessage!, presentationWitness);
    expect(bus.pending("verifier")).toBe(1);

    // Step 3: Verifier receives submission and evaluates
    const submission = bus.receive("verifier");
    expect(submission).toBeDefined();
    expect(submission!.type).toBe("presentation:submission");
    const submissionBody =
      submission!.body as BirthCredentialVerificationSubmission;
    pureCircuits.assertBirthCredentialVerificationSubmissionMatchesRequest(
      presentationRequest,
      submissionBody,
    );

    // Simulator witness: private data passed directly to the verifier (not via bus)
    const simulatorWitness: SimulatorWitness = {
      request: presentationRequest,
      currentDay: 3650n + 365n * 25n,
      birthDateDays: claimWitness.birthDateDays,
      birthDateOpening: claimWitness.birthDateOpening,
    };

    const result = verifier.receiveSubmissionAndEvaluate(submission!, simulatorWitness);
    expect(result.approved).toBe(true);
    pureCircuits.assertBirthCredentialVerificationResultMatchesSubmission(
      submissionBody,
      result.result,
    );
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

    const requestMessage = bus.receive("holder")!;
    const requestBody = requestMessage.body as BirthCredentialVerificationRequest;
    pureCircuits.assertValidBirthCredentialVerificationRequestMessage(
      requestBody,
    );
    const presentationRequest = requestBody;

    // Alice is 25 years old: currentDay = 3650 + 365*25 = 12775
    const presentationWitness: PresentationWitness = {
      credentialIndex: 0,
      currentDay: 3650n + 365n * 25n,
      birthDateDays: claimWitness.birthDateDays,
      birthDateOpening: claimWitness.birthDateOpening,
      birthCountryCodePadded: claimWitness.birthCountryCodePadded,
      birthCountryCodeOpening: claimWitness.birthCountryCodeOpening,
    };

    holder.receiveRequestAndSendPresentation(requestMessage, presentationWitness);

    const submission = bus.receive("verifier")!;
    const submissionBody =
      submission.body as BirthCredentialVerificationSubmission;
    pureCircuits.assertBirthCredentialVerificationSubmissionMatchesRequest(
      presentationRequest,
      submissionBody,
    );

    // Simulator witness: private data passed directly to the verifier (not via bus)
    const simulatorWitness: SimulatorWitness = {
      request: presentationRequest,
      currentDay: 3650n + 365n * 25n,
      birthDateDays: claimWitness.birthDateDays,
      birthDateOpening: claimWitness.birthDateOpening,
    };

    // The verifier evaluation should throw because the age predicate fails
    expect(() => verifier.receiveSubmissionAndEvaluate(submission, simulatorWitness)).toThrow();
  });
});
