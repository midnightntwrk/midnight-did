import { describe, expect,it } from "vitest";

import {
  pureCircuits as genericPureCircuits,
  type SecretBirthCredentialPresentationRequest,
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

describe("secret-holder pseudonym", () => {
  const issuerProfile = createDIDProfile("issuer", "issuer", 123456789n);
  const verifierProfile = createDIDProfile("verifier", "verifier", 555555555n);

  const holderConfig = {
    label: "holder",
    holderSecret: sha256("holder-secret:alice"),
    holderSecretOpening: sha256("opening:holder-secret"),
  };

  const verifierDomainHash = sha256("verifier-domain:age-gateway.example");

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
    holder.receiveOfferAndSendRequest(bus.receive("holder")!);
    issuer.receiveRequestAndIssueCredential(
      bus.receive("issuer")!,
      claimWitness,
    );
    holder.receiveCredentialResult(bus.receive("holder")!);

    return holder;
  };

  it("derives a stable verifier-scoped pseudonym for the same holder and domain", () => {
    const bus = new MessageBus();
    const holder = issueCredential(bus);
    const verifier = new VerifierAgent(verifierProfile, bus);

    expect(holder.credentialCount).toBe(1);

    // Verifier requests pseudonym disclosure
    verifier.createAndSendSecretPresentationRequest("holder", {
      issuerVerificationMethodRef: issuerProfile.signer.verificationMethodRef,
      requireSubjectIdCommitmentDisclosure: false,
      requireBirthCountryDisclosure: true,
      requireVerifierScopedPseudonym: true,
      verifierDomainHash,
      requireAgeOverThreshold: true,
      requestedAgeThresholdYears: 18,
    });

    const requestMessage = bus.receive("holder")!;
    const presentationRequest =
      requestMessage.body as SecretBirthCredentialPresentationRequest;

    const presentationWitness: SecretPresentationWitness = {
      credentialIndex: 0,
      currentDay: 3650n + 365n * 25n,
      birthDateDays: claimWitness.birthDateDays,
      birthDateOpening: claimWitness.birthDateOpening,
      birthCountryCodePadded: claimWitness.birthCountryCodePadded,
      birthCountryCodeOpening: claimWitness.birthCountryCodeOpening,
    };

    holder.receiveRequestAndSendPresentation(requestMessage, presentationWitness);

    const submission = bus.receive("verifier")!;

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

    const result = verifier.receiveSecretSubmissionAndEvaluate(submission, simulatorWitness);

    expect(result.approved).toBe(true);
    expect(result.pseudonym).toBeDefined();
    expect(result.pseudonym!.length).toBe(32);

    // The pseudonym should be deterministic for the same holder secret + domain
    const expectedPseudonym = genericPureCircuits.verifierScopedPseudonym(
      holderConfig.holderSecret,
      verifierDomainHash,
    );
    expect(result.pseudonym).toEqual(expectedPseudonym);
  });
});
