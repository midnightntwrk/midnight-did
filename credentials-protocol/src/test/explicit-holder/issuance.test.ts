import { describe, expect,it } from "vitest";

import {
  type BirthCredentialIssuanceOffer,
  type BirthCredentialIssuanceRequest,
  type BirthCredentialIssuanceResult,
  pureCircuits,
} from "../../../../credentials-birth/src/managed/birth-credential/contract/index.js";
import { HolderAgent } from "../../agents/holder-agent.js";
import { type ClaimWitness,IssuerAgent } from "../../agents/issuer-agent.js";
import { MessageBus } from "../../transport/message-bus.js";
import {
  createDIDProfile,
  fill,
  padText,
  sha256,
} from "../helpers/did-provider.js";

describe("explicit-holder issuance", () => {
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

  it("completes an issuance flow through offer -> request -> credential", () => {
    const bus = new MessageBus();
    const issuer = new IssuerAgent(issuerProfile, bus);
    const holder = new HolderAgent(holderProfile, bus);

    // Step 1: Issuer creates and sends offer to holder
    issuer.createAndSendOffer("holder");
    expect(bus.pending("holder")).toBe(1);

    // Step 2: Holder receives offer and sends request back to issuer
    const offer = bus.receive("holder");
    expect(offer).toBeDefined();
    expect(offer!.type).toBe("issuance:offer");
    const offerBody = offer!.body as BirthCredentialIssuanceOffer;
    pureCircuits.assertValidBirthCredentialIssuanceOffer(offerBody);
    holder.receiveOfferAndSendRequest(offer!);
    expect(bus.pending("issuer")).toBe(1);

    // Step 3: Issuer receives request and issues the credential
    const request = bus.receive("issuer");
    expect(request).toBeDefined();
    expect(request!.type).toBe("issuance:request");
    const requestBody = request!.body as BirthCredentialIssuanceRequest;
    pureCircuits.assertValidBirthCredentialIssuanceRequest(requestBody);
    pureCircuits.assertBirthCredentialIssuanceRequestMatchesOffer(
      offerBody,
      requestBody,
    );
    issuer.receiveRequestAndIssueCredential(request!, claimWitness);
    expect(bus.pending("holder")).toBe(1);

    // Step 4: Holder receives the credential result
    const result = bus.receive("holder");
    expect(result).toBeDefined();
    expect(result!.type).toBe("issuance:result");
    const resultBody = result!.body as BirthCredentialIssuanceResult;
    pureCircuits.assertValidBirthCredentialIssuanceResult(resultBody);
    pureCircuits.assertBirthCredentialIssuanceResultMatchesRequest(
      requestBody,
      resultBody,
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
  });

  it("binds the credential to the correct holder DID", () => {
    const bus = new MessageBus();
    const issuer = new IssuerAgent(issuerProfile, bus);
    const holder = new HolderAgent(holderProfile, bus);

    // Run the full issuance flow
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

    const stored = holder.getCredential(0);

    // The credential's holderBinding must reference the holder's verification method
    const binding = stored.credential.holderBinding;
    expect(binding.holderVerificationMethodRef).toBeDefined();
    expect(binding.holderVerificationMethodRef.didContractAddress.bytes).toEqual(
      holderProfile.signer.verificationMethodRef.didContractAddress.bytes,
    );
    expect(binding.holderVerificationMethodRef.methodId).toEqual(
      holderProfile.signer.verificationMethodRef.methodId,
    );

    // The credential proof must reference the issuer's verification method
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
