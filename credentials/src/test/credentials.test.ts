import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { pureCircuits } from "../managed/credentials/contract/index.js";
import { createProofFixture } from "./proof-fixtures.js";

setNetworkId("undeployed");

describe("generic credentials proof helpers", () => {
  it("verifies a proof against the supplied body root", () => {
    const fixture = createProofFixture();

    expect(() =>
      pureCircuits.assertValidIssuanceContextProof(
        fixture.bodyRoot,
        fixture.proof,
      ),
    ).not.toThrow();
  });

  it("rejects the proof when the body root changes", () => {
    const fixture = createProofFixture();
    const tamperedBodyRoot = new Uint8Array(fixture.bodyRoot);
    tamperedBodyRoot[0] ^= 0xff;

    expect(() =>
      pureCircuits.assertValidIssuanceContextProof(
        tamperedBodyRoot,
        fixture.proof,
      ),
    ).toThrow(/Signature verification failed/);
  });

  it("rejects the proof when the challenge binding changes", () => {
    const fixture = createProofFixture();
    const tamperedProof = {
      ...fixture.proof,
      challengeHash: new Uint8Array(32).fill(7),
    };

    expect(() =>
      pureCircuits.assertValidIssuanceContextProof(
        fixture.bodyRoot,
        tamperedProof,
      ),
    ).toThrow(/Signature verification failed/);
  });

  it("derives verifier-scoped pseudonyms from the hidden holder secret", () => {
    const holderSecret = new Uint8Array(32).fill(1);
    const verifierDomainHash = new Uint8Array(32).fill(2);
    const pseudonym = pureCircuits.verifierScopedPseudonym(
      holderSecret,
      verifierDomainHash,
    );

    expect(() =>
      pureCircuits.assertVerifierScopedPseudonym(
        pseudonym,
        holderSecret,
        verifierDomainHash,
      ),
    ).not.toThrow();

    expect(() =>
      pureCircuits.assertVerifierScopedPseudonym(
        pseudonym,
        holderSecret,
        new Uint8Array(32).fill(3),
      ),
    ).toThrow(
      /Verifier-scoped pseudonym does not match the holder secret and verifier domain/,
    );
  });

  it("checks blinded holder-binding witnesses without exposing the raw holder commitment", () => {
    const holderSecret = new Uint8Array(32).fill(4);
    const opening = new Uint8Array(32).fill(5);
    const blindingFactor = new Uint8Array(32).fill(6);
    const verifierChallengeHash = new Uint8Array(32).fill(7);
    const issuerNonce = new Uint8Array(32).fill(8);
    const holderSecretCommitment = pureCircuits.secretHolderBindingCommitment(
      holderSecret,
      opening,
    );
    const binding = {
      blindedHolderSecretCommitment:
        pureCircuits.blindedSecretHolderCommitment(
          holderSecretCommitment,
          issuerNonce,
          blindingFactor,
        ),
      issuerNonce,
      requestChallengeResponse: pureCircuits.secretHolderBindingChallengeResponse(
        holderSecret,
        verifierChallengeHash,
      ),
    };

    expect(() =>
      pureCircuits.assertBlindedSecretHolderBindingWitness(
        binding,
        verifierChallengeHash,
        holderSecret,
        opening,
        blindingFactor,
      ),
    ).not.toThrow();

    expect(() =>
      pureCircuits.assertBlindedSecretHolderBindingWitness(
        binding,
        verifierChallengeHash,
        holderSecret,
        opening,
        new Uint8Array(32).fill(9),
      ),
    ).toThrow(
      /Blinded holder commitment does not match the hidden holder secret witness/,
    );
  });
});
