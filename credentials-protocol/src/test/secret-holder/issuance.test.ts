import { describe, it, expect } from "vitest";

import { MessageBus } from "../../transport/message-bus.js";
import {
  SecretIssuerAgent,
  type SecretClaimWitness,
  type SecretIssuanceRequest,
} from "../../agents/secret-issuer-agent.js";
import { SecretHolderAgent } from "../../agents/secret-holder-agent.js";
import {
  createDIDProfile,
  sha256,
  padText,
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
    holder.receiveOfferAndSendRequest(offer!);
    expect(bus.pending("issuer")).toBe(1);

    // Step 3: Issuer receives request and issues the credential
    const request = bus.receive("issuer");
    expect(request).toBeDefined();
    expect(request!.type).toBe("issuance:request");
    issuer.receiveRequestAndIssueCredential(request!, claimWitness);
    expect(bus.pending("holder")).toBe(1);

    // Step 4: Holder receives the credential result
    const result = bus.receive("holder");
    expect(result).toBeDefined();
    expect(result!.type).toBe("issuance:result");
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
    holder.receiveOfferAndSendRequest(bus.receive("holder")!);

    // Intercept the request message to inspect what the holder sent
    const requestMsg = bus.receive("issuer")!;
    const requestBody = (requestMsg.body as SecretIssuanceRequest).body;

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
    holder.receiveCredentialResult(bus.receive("holder")!);

    // The credential's proof must reference the issuer's verification method
    const stored = holder.getCredential(0);
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
