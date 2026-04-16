import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { pureCircuits } from "../managed/credentials/contract/index.js";
import { createProofFixture } from "./proof-fixtures.js";

setNetworkId("undeployed");

describe("credentials core: proof context", () => {
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
});
