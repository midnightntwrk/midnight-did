import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { pureCircuits } from "../managed/demo/contract/index.js";
import {
  createBirthCredentialFixture,
  createSigner,
  signProof,
} from "./demo-fixtures.js";
import { CredentialsDemoSimulator } from "./demo-simulator.js";

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
    const attacker = createSigner("attacker", 111111111n, 1n);
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
});
