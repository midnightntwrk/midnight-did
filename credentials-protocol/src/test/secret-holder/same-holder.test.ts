import { describe, expect,it } from "vitest";

import { SecretHolderAgent } from "../../agents/secret-holder-agent.js";
import {
  type SecretClaimWitness,
  SecretIssuerAgent,
} from "../../agents/secret-issuer-agent.js";
import { type SameHolderSimulatorWitness,VerifierAgent } from "../../agents/verifier-agent.js";
import { MessageBus } from "../../transport/message-bus.js";
import {
  createDIDProfile,
  fill,
  padText,
  sha256,
} from "../helpers/did-provider.js";

describe("secret-holder same-holder composition", () => {
  const ritaProfile = createDIDProfile("issuer", "rita", 123456789n);
  const governmentProfile = createDIDProfile(
    "issuer",
    "government",
    111111111n,
  );
  const verifierProfile = createDIDProfile("verifier", "verifier", 555555555n);

  const aliceHolderConfig = {
    label: "alice",
    holderSecret: fill(11),
    holderSecretOpening: fill(13),
  };

  const ritaClaimWitness: SecretClaimWitness = {
    subjectId: sha256("subject:alice:rita"),
    subjectOpening: sha256("opening:subject:rita"),
    legalNamePadded: padText("Alice Example"),
    legalNameOpening: sha256("opening:legal-name:rita"),
    birthDateDays: 3650n,
    birthDateOpening: sha256("opening:birth-date:rita"),
    birthCountryCodePadded: padText("CAN"),
    birthCountryCodeOpening: sha256("opening:birth-country:rita"),
    issuedAt: 10_000n,
    expiresAt: 20_000n,
  };

  const governmentClaimWitness: SecretClaimWitness = {
    subjectId: sha256("subject:alice:gov"),
    subjectOpening: sha256("opening:subject:gov"),
    legalNamePadded: padText("Alice Example"),
    legalNameOpening: sha256("opening:legal-name:gov"),
    birthDateDays: 3650n,
    birthDateOpening: sha256("opening:birth-date:gov"),
    birthCountryCodePadded: padText("CAN"),
    birthCountryCodeOpening: sha256("opening:birth-country:gov"),
    issuedAt: 11_000n,
    expiresAt: 21_000n,
  };

  /**
   * Issue a credential from the given issuer to the given holder via the bus.
   */
  const issueCredential = (
    bus: MessageBus,
    issuer: ReturnType<typeof createDIDProfile>,
    holder: SecretHolderAgent,
    claimWitness: SecretClaimWitness,
  ): void => {
    const issuerAgent = new SecretIssuerAgent(issuer, bus);
    issuerAgent.createAndSendOffer(holder["label"]);
    holder.receiveOfferAndSendRequest(bus.receive(holder["label"])!);
    issuerAgent.receiveRequestAndIssueCredential(
      bus.receive(issuer.label)!,
      claimWitness,
    );
    holder.receiveCredentialResult(bus.receive(holder["label"])!);
  };

  it("proves two credentials from different issuers belong to the same hidden holder", () => {
    const bus = new MessageBus();
    const alice = new SecretHolderAgent(aliceHolderConfig, bus);
    const verifier = new VerifierAgent(verifierProfile, bus);

    // Issue credential 1 from rita
    issueCredential(bus, ritaProfile, alice, ritaClaimWitness);
    // Issue credential 2 from government
    issueCredential(bus, governmentProfile, alice, governmentClaimWitness);

    expect(alice.credentialCount).toBe(2);

    // Build same-holder proof with the verifier's challenge
    const challenge = verifier.generateChallenge();
    const presentation = alice.buildSameHolderProof([0, 1], challenge);

    // Build simulator witness: private data passed directly to the verifier (not via bus)
    const { holderSecret, holderSecretOpening } = alice.secretWitness;
    const firstStored = alice.getCredential(0);
    const secondStored = alice.getCredential(1);
    const simulatorWitness: SameHolderSimulatorWitness = {
      holderSecret,
      firstHolderSecretOpening: holderSecretOpening,
      firstHolderBindingBlindingFactor: firstStored.holderBindingBlindingFactor,
      secondHolderSecretOpening: holderSecretOpening,
      secondHolderBindingBlindingFactor: secondStored.holderBindingBlindingFactor,
    };

    // Verify the same-holder proof
    const result = verifier.verifySameHolderProof(presentation, simulatorWitness);
    expect(result.sameHolder).toBe(true);
  });

  it("rejects same-holder proof when credentials have different holder secrets", () => {
    const bus = new MessageBus();
    const alice = new SecretHolderAgent(aliceHolderConfig, bus);

    const bobHolderConfig = {
      label: "bob",
      holderSecret: fill(99),
      holderSecretOpening: fill(13),
    };
    const bob = new SecretHolderAgent(bobHolderConfig, bus);

    const verifier = new VerifierAgent(verifierProfile, bus);

    // Issue credential to alice from rita
    issueCredential(bus, ritaProfile, alice, ritaClaimWitness);
    // Issue credential to bob from government
    issueCredential(bus, governmentProfile, bob, governmentClaimWitness);

    expect(alice.credentialCount).toBe(1);
    expect(bob.credentialCount).toBe(1);

    const challenge = verifier.generateChallenge();

    // Alice tries to build a same-holder proof mixing her credential
    // with Bob's credential -- this should fail because the holder
    // secrets differ.
    const aliceCredential = alice.getCredential(0);
    const bobCredential = bob.getCredential(0);

    const presentation = alice.buildSameHolderProofWith(
      aliceCredential,
      bobCredential,
      challenge,
    );

    // Build simulator witness using Alice's secrets -- the second credential
    // belongs to Bob, so the blinding factor comes from Bob's stored credential
    const { holderSecret, holderSecretOpening } = alice.secretWitness;
    const simulatorWitness: SameHolderSimulatorWitness = {
      holderSecret,
      firstHolderSecretOpening: holderSecretOpening,
      firstHolderBindingBlindingFactor: aliceCredential.holderBindingBlindingFactor,
      secondHolderSecretOpening: holderSecretOpening,
      secondHolderBindingBlindingFactor: bobCredential.holderBindingBlindingFactor,
    };

    expect(() => verifier.verifySameHolderProof(presentation, simulatorWitness)).toThrow(
      /Blinded holder commitment does not match the hidden holder secret witness/,
    );
  });
});
