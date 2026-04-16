import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { AccessDecision } from "../managed/demo/contract/index.js";
import { pureCircuits } from "../managed/demo/contract/index.js";
import { CredentialsDemoSimulator } from "../simulator.js";
import {
  createBirthCredentialFixture,
  createSigner,
  signProof,
} from "./demo-fixtures.js";

setNetworkId("undeployed");

describe("credentials demo contract", () => {
  it("records issued credentials and verifies an age presentation against private witness data", () => {
    const fixture = createBirthCredentialFixture();
    const simulator = new CredentialsDemoSimulator();

    simulator.issueBirthCredential(
      fixture.credential,
      fixture.credentialProof,
      fixture.holder.publicKey,
    );
    simulator.setAgeWitness(
      fixture.witness.birthDateDays,
      fixture.witness.birthDateOpening,
    );
    simulator.verifyBirthPresentationForRequest(
      fixture.credential,
      fixture.credentialProof,
      fixture.presentationRequest,
      fixture.presentation,
      fixture.presentationProof,
      fixture.witness.currentDay,
    );

    const state = simulator.getLedger();
    const credentialRoot = pureCircuits.birthCredentialBodyRoot(fixture.credential);

    expect(state.issuedCredentialCount).toEqual(1n);
    expect(state.verifiedPresentationCount).toEqual(1n);
    expect(state.issuedCredentialClaimRoots.member(credentialRoot)).toEqual(true);
    expect(state.lastVerifiedCredentialRoot).toEqual(credentialRoot);
    expect(state.lastVerifiedCurrentDay).toEqual(fixture.witness.currentDay);
    expect(state.lastVerifiedThresholdYears).toEqual(
      fixture.presentation.disclosed.ageThresholdYears,
    );
    expect(state.lastVerifiedRequestChallenge).toEqual(
      fixture.presentationRequest.verifierChallengeHash,
    );
  });

  it("rejects presentation verification when the credential was never issued", () => {
    const fixture = createBirthCredentialFixture();
    const simulator = new CredentialsDemoSimulator();

    simulator.setAgeWitness(
      fixture.witness.birthDateDays,
      fixture.witness.birthDateOpening,
    );

    expect(() =>
      simulator.verifyBirthPresentation(
        fixture.credential,
        fixture.credentialProof,
        fixture.presentation,
        fixture.presentationProof,
        fixture.witness.currentDay,
      ),
    ).toThrow(/Credential was not issued by the demo contract/);
  });

  it("rejects presentation verification when the holder proof key does not match the issued binding", () => {
    const fixture = createBirthCredentialFixture();
    const simulator = new CredentialsDemoSimulator();
    const attacker = createSigner("attacker", 111111111n);
    const attackerProof = signProof({
      bodyRoot: pureCircuits.birthCredentialPresentationBodyRoot(fixture.presentation),
      context: "presentation",
      signer: attacker,
      createdAt: fixture.presentationProof.createdAt + 1n,
      challengeHash: fixture.presentationProof.challengeHash,
      nonceScalar: 29n,
    });

    simulator.issueBirthCredential(
      fixture.credential,
      fixture.credentialProof,
      fixture.holder.publicKey,
    );
    simulator.setAgeWitness(
      fixture.witness.birthDateDays,
      fixture.witness.birthDateOpening,
    );

    expect(() =>
      simulator.verifyBirthPresentation(
        fixture.credential,
        fixture.credentialProof,
        fixture.presentation,
        attackerProof,
        fixture.witness.currentDay,
      ),
    ).toThrow(/Presentation proof signer must match holder binding/);
  });

  it("rejects presentation verification when the private age witness is too young", () => {
    const fixture = createBirthCredentialFixture();
    const simulator = new CredentialsDemoSimulator();

    simulator.issueBirthCredential(
      fixture.credential,
      fixture.credentialProof,
      fixture.holder.publicKey,
    );
    simulator.setAgeWitness(
      fixture.witness.currentDay - 365n * 10n,
      fixture.witness.birthDateOpening,
    );

    expect(() =>
      simulator.verifyBirthPresentation(
        fixture.credential,
        fixture.credentialProof,
        fixture.presentation,
        fixture.presentationProof,
        fixture.witness.currentDay,
      ),
    ).toThrow(/Birth-date witness does not match credential commitment|Age predicate does not satisfy the requested threshold/);
  });

  it("rejects verification when the presentation does not satisfy the verifier request", () => {
    const fixture = createBirthCredentialFixture();
    const simulator = new CredentialsDemoSimulator();
    const stricterRequest = {
      ...fixture.presentationRequest,
      requireSubjectIdCommitmentDisclosure: true,
    };

    simulator.issueBirthCredential(
      fixture.credential,
      fixture.credentialProof,
      fixture.holder.publicKey,
    );
    simulator.setAgeWitness(
      fixture.witness.birthDateDays,
      fixture.witness.birthDateOpening,
    );

    expect(() =>
      simulator.verifyBirthPresentationForRequest(
        fixture.credential,
        fixture.credentialProof,
        stricterRequest,
        fixture.presentation,
        fixture.presentationProof,
        fixture.witness.currentDay,
      ),
    ).toThrow(/Presentation request requires the subject-id commitment disclosure/);
  });

  it("exposes a typed age-gate requirement and issues a reusable capability after successful verification", () => {
    const fixture = createBirthCredentialFixture();
    const simulator = new CredentialsDemoSimulator();
    const request = simulator.ageGateRequest(
      fixture.credential.issuerVerificationMethodRef,
      fixture.presentationRequest.verifierChallengeHash,
    );

    expect(request.requireBirthCountryDisclosure).toEqual(true);
    expect(request.requireAgeOverThreshold).toEqual(true);
    expect(request.requestedAgeThresholdYears).toEqual(18n);
    expect(request.verifierChallengeHash).toEqual(
      fixture.presentationRequest.verifierChallengeHash,
    );

    simulator.issueBirthCredential(
      fixture.credential,
      fixture.credentialProof,
      fixture.holder.publicKey,
    );
    simulator.setAgeWitness(
      fixture.witness.birthDateDays,
      fixture.witness.birthDateOpening,
    );

    const capability = simulator.issueAgeGateCapability(
      fixture.credential,
      fixture.credentialProof,
      fixture.presentation,
      fixture.presentationProof,
      fixture.presentationRequest.verifierChallengeHash,
      fixture.witness.currentDay,
    );

    const state = simulator.getLedger();
    expect(state.issuedAccessCapabilityCount).toEqual(1n);
    expect(state.activeAccessCapabilities.member(capability)).toEqual(true);
    expect(state.lastIssuedAccessCapability).toEqual(capability);
    expect(state.lastBusinessDecision).toEqual(AccessDecision.approved);
  });

  it("supports a soft business denial when a capability is unknown or already consumed", () => {
    const fixture = createBirthCredentialFixture();
    const simulator = new CredentialsDemoSimulator();

    simulator.issueBirthCredential(
      fixture.credential,
      fixture.credentialProof,
      fixture.holder.publicKey,
    );
    simulator.setAgeWitness(
      fixture.witness.birthDateDays,
      fixture.witness.birthDateOpening,
    );

    const capability = simulator.issueAgeGateCapability(
      fixture.credential,
      fixture.credentialProof,
      fixture.presentation,
      fixture.presentationProof,
      fixture.presentationRequest.verifierChallengeHash,
      fixture.witness.currentDay,
    );

    const firstClaim = simulator.claimAgeGateCapability(capability);
    const secondClaim = simulator.claimAgeGateCapability(capability);
    const unknownClaim = simulator.claimAgeGateCapability(new Uint8Array(32).fill(42));

    const state = simulator.getLedger();

    expect(firstClaim).toEqual(AccessDecision.approved);
    expect(secondClaim).toEqual(AccessDecision.alreadyConsumed);
    expect(unknownClaim).toEqual(AccessDecision.unknownCapability);
    expect(state.consumedAccessCapabilityCount).toEqual(1n);
    expect(state.activeAccessCapabilities.member(capability)).toEqual(false);
    expect(state.consumedAccessCapabilities.member(capability)).toEqual(true);
    expect(state.lastBusinessDecision).toEqual(AccessDecision.unknownCapability);
  });
});
