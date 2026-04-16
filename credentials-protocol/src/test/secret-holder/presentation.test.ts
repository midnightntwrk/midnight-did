import { describe, expect,it } from "vitest";

import { pureCircuits as genericPureCircuits } from "../../../../credentials/src/managed/credentials/contract/index.js";
import {
  pureCircuits,
  type SecretBirthCredentialVerificationRequest,
} from "../../../../credentials-birth-secret/src/managed/secret-birth-credential/contract/index.js";
import {
  SecretHolderAgent,
  type SecretPresentationWitness,
} from "../../agents/secret-holder-agent.js";
import {
  type SecretClaimWitness,
  SecretIssuerAgent,
} from "../../agents/secret-issuer-agent.js";
import { type SecretSimulatorWitness,VerifierAgent } from "../../agents/verifier-agent.js";
import { MessageBus } from "../../transport/message-bus.js";
import {
  createDIDProfile,
  padText,
  sha256,
} from "../helpers/did-provider.js";

describe("secret-holder presentation", () => {
  const issuerProfile = createDIDProfile("issuer", "issuer", 123456789n);
  const verifierProfile = createDIDProfile("verifier", "verifier", 555555555n);

  const holderConfig = {
    label: "holder",
    holderSecret: sha256("holder-secret:alice"),
    holderSecretOpening: sha256("opening:holder-secret"),
  };

  const claimWitness: SecretClaimWitness = {
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

  /**
   * Run the full issuance flow and return a holder with one stored credential.
   */
  const issueCredential = (bus: MessageBus): SecretHolderAgent => {
    const issuer = new SecretIssuerAgent(issuerProfile, bus);
    const holder = new SecretHolderAgent(holderConfig, bus);

    issuer.createAndSendOffer("holder");
    const offer = bus.receive("holder")!;
    genericPureCircuits.assertValidProtocolMessageEnvelope(offer.envelope);
    holder.receiveOfferAndSendRequest(offer);
    const request = bus.receive("issuer")!;
    genericPureCircuits.assertValidProtocolMessageEnvelope(request.envelope);
    genericPureCircuits.assertProtocolResponseEnvelope(
      offer.envelope,
      request.envelope,
    );
    issuer.receiveRequestAndIssueCredential(
      request,
      claimWitness,
    );
    const result = bus.receive("holder")!;
    genericPureCircuits.assertValidProtocolMessageEnvelope(result.envelope);
    genericPureCircuits.assertProtocolResponseEnvelope(
      request.envelope,
      result.envelope,
    );
    holder.receiveCredentialResult(result);

    return holder;
  };

  it("presents a secret-holder credential with age predicate", () => {
    const bus = new MessageBus();
    const holder = issueCredential(bus);
    const verifier = new VerifierAgent(verifierProfile, bus);

    expect(holder.credentialCount).toBe(1);

    // Step 1: Verifier sends a secret presentation request to the holder
    verifier.createAndSendSecretPresentationRequest("holder", {
      issuerVerificationMethodRef: issuerProfile.signer.verificationMethodRef,
      requireSubjectIdCommitmentDisclosure: false,
      requireBirthCountryDisclosure: true,
      requireVerifierScopedPseudonym: false,
      requireAgeOverThreshold: true,
      requestedAgeThresholdYears: 18,
    });
    expect(bus.pending("holder")).toBe(1);

    // Step 2: Holder receives request and builds presentation
    const requestMessage = bus.receive("holder");
    expect(requestMessage).toBeDefined();
    expect(requestMessage!.type).toBe("presentation:request");
    genericPureCircuits.assertValidProtocolMessageEnvelope(
      requestMessage!.envelope,
    );
    const requestBody =
      requestMessage!.body as SecretBirthCredentialVerificationRequest;
    pureCircuits.assertValidSecretBirthCredentialVerificationRequestMessage(
      requestBody,
    );

    // Capture the request for the simulator witness
    const presentationRequest = requestBody;

    // Alice is 25 years old: birthDateDays=3650, currentDay = 3650 + 365*25 = 12775
    const presentationWitness: SecretPresentationWitness = {
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
    genericPureCircuits.assertValidProtocolMessageEnvelope(submission!.envelope);
    genericPureCircuits.assertProtocolResponseEnvelope(
      requestMessage!.envelope,
      submission!.envelope,
    );

    // Simulator witness: private data passed directly to the verifier (not via bus)
    const stored = holder.getCredential(0);
    const { holderSecret, holderSecretOpening } = holder.secretWitness;
    const simulatorWitness: SecretSimulatorWitness = {
      request: presentationRequest,
      currentDay: 3650n + 365n * 25n,
      birthDateDays: claimWitness.birthDateDays,
      birthDateOpening: claimWitness.birthDateOpening,
      holderSecret,
      holderSecretOpening,
      holderBindingBlindingFactor: stored.holderBindingBlindingFactor,
    };

    const result = verifier.receiveSecretSubmissionAndEvaluate(submission!, simulatorWitness);
    expect(result.approved).toBe(true);
  });
});
