import { describe, expect,it } from "vitest";

import { pureCircuits as genericPureCircuits } from "../../../../credentials/src/managed/credentials/contract/index.js";
import {
  pureCircuits,
  type SecretBirthCredentialIssuanceRequest,
} from "../../../../credentials-birth-secret/src/managed/secret-birth-credential/contract/index.js";
import { SecretHolderAgent } from "../../agents/secret-holder-agent.js";
import {
  type SecretClaimWitness,
  SecretIssuerAgent,
} from "../../agents/secret-issuer-agent.js";
import { MessageBus } from "../../transport/message-bus.js";
import {
  createDIDProfile,
  padText,
  sha256,
} from "../helpers/did-provider.js";

describe("secret-holder issuance", () => {
  const issuerProfile = createDIDProfile("issuer", "issuer", 123456789n);

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

  it("issues a credential with blinded secret holder binding", () => {
    const bus = new MessageBus();
    const issuer = new SecretIssuerAgent(issuerProfile, bus);
    const holder = new SecretHolderAgent(holderConfig, bus);

    // Step 1: Issuer creates and sends offer to holder
    issuer.createAndSendOffer("holder");
    expect(bus.pending("holder")).toBe(1);

    // Step 2: Holder receives offer and sends request back to issuer
    const offer = bus.receive("holder");
    expect(offer).toBeDefined();
    expect(offer!.type).toBe("issuance:offer");
    genericPureCircuits.assertValidProtocolMessageEnvelope(offer!.envelope);
    holder.receiveOfferAndSendRequest(offer!);
    expect(bus.pending("issuer")).toBe(1);

    // Step 3: Issuer receives request and issues the credential
    const request = bus.receive("issuer");
    expect(request).toBeDefined();
    expect(request!.type).toBe("issuance:request");
    genericPureCircuits.assertValidProtocolMessageEnvelope(request!.envelope);
    genericPureCircuits.assertProtocolResponseEnvelope(
      offer!.envelope,
      request!.envelope,
    );
    issuer.receiveRequestAndIssueCredential(request!, claimWitness);
    expect(bus.pending("holder")).toBe(1);

    // Step 4: Holder receives the credential result
    const result = bus.receive("holder");
    expect(result).toBeDefined();
    expect(result!.type).toBe("issuance:result");
    genericPureCircuits.assertValidProtocolMessageEnvelope(result!.envelope);
    genericPureCircuits.assertProtocolResponseEnvelope(
      request!.envelope,
      result!.envelope,
    );
    holder.receiveCredentialResult(result!);

    // Verify the credential was stored
    expect(holder.credentialCount).toBe(1);

    const stored = holder.getCredential(0);
    expect(stored.credential).toBeDefined();
    expect(stored.credentialProof).toBeDefined();
    expect(stored.credential.version).toBe(1n);
    expect(stored.credential.issuedAt).toBe(10_000n);
    expect(stored.credential.hasExpiration).toBe(true);
    expect(stored.credential.expiresAt).toBe(20_000n);
    pureCircuits.assertValidSecretBirthCredential(
      stored.credential,
      stored.credentialProof,
    );

    // Verify it has blinded secret holder binding fields
    const binding = stored.credential.holderBinding;
    expect(binding.blindedHolderSecretCommitment).toBeDefined();
    expect(binding.blindedHolderSecretCommitment.length).toBe(32);
    expect(binding.issuerNonce).toBeDefined();
    expect(binding.issuerNonce.length).toBe(32);
  });

  it("binds the blinded commitment to the holder secret without revealing it to the issuer", () => {
    const bus = new MessageBus();
    const issuer = new SecretIssuerAgent(issuerProfile, bus);
    const holder = new SecretHolderAgent(holderConfig, bus);

    // Run the issuance flow
    issuer.createAndSendOffer("holder");
    const offer = bus.receive("holder")!;
    genericPureCircuits.assertValidProtocolMessageEnvelope(offer.envelope);
    holder.receiveOfferAndSendRequest(offer);

    // Intercept the request message to inspect what the holder sent
    const requestMsg = bus.receive("issuer")!;
    genericPureCircuits.assertValidProtocolMessageEnvelope(requestMsg.envelope);
    genericPureCircuits.assertProtocolResponseEnvelope(
      offer.envelope,
      requestMsg.envelope,
    );
    const requestBody = (requestMsg.body as SecretBirthCredentialIssuanceRequest).body;

    // The request should contain a commitment, NOT the raw secret
    expect(requestBody.holderSecretCommitment).toBeDefined();
    expect(requestBody.holderSecretCommitment.length).toBe(32);
    expect(requestBody.holderBindingBlindingFactor).toBeDefined();
    expect(requestBody.holderBindingBlindingFactor.length).toBe(32);

    // The commitment should NOT be the raw secret
    expect(requestBody.holderSecretCommitment).not.toEqual(
      holderConfig.holderSecret,
    );

    // Complete the issuance
    issuer.receiveRequestAndIssueCredential(requestMsg, claimWitness);
    const result = bus.receive("holder")!;
    genericPureCircuits.assertValidProtocolMessageEnvelope(result.envelope);
    genericPureCircuits.assertProtocolResponseEnvelope(
      requestMsg.envelope,
      result.envelope,
    );
    holder.receiveCredentialResult(result);

    // The credential's proof must reference the issuer's verification method
    const stored = holder.getCredential(0);
    pureCircuits.assertValidSecretBirthCredential(
      stored.credential,
      stored.credentialProof,
    );
    const proof = stored.credentialProof;
    expect(
      proof.signerVerificationMethodRef.didContractAddress.bytes,
    ).toEqual(
      issuerProfile.signer.verificationMethodRef.didContractAddress.bytes,
    );
    expect(proof.signerVerificationMethodRef.methodId).toEqual(
      issuerProfile.signer.verificationMethodRef.methodId,
    );
  });
});
