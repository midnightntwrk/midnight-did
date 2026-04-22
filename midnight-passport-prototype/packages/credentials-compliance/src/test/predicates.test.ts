import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { createSanctionScreeningFixture } from "../fixtures/credential-fixtures.js";
import { pureCircuits } from "../managed/sanction-screening-credential/contract/index.js";

setNetworkId("undeployed");

describe("sanction screening credential: predicates", () => {
  it("validates PASS screening and non-PEP disclosures", () => {
    const fixture = createSanctionScreeningFixture();

    expect(() =>
      pureCircuits.assertSanctionScreeningResultPass(
        fixture.credential,
        fixture.presentation,
      ),
    ).not.toThrow();
    expect(() =>
      pureCircuits.assertSanctionScreeningPepFalse(
        fixture.credential,
        fixture.presentation,
      ),
    ).not.toThrow();
  });

  it("rejects failed screening and PEP subjects", () => {
    const failed = createSanctionScreeningFixture({
      screeningResult: pureCircuits.screeningResultFail(),
    });
    const pep = createSanctionScreeningFixture({ isPep: true });

    expect(() =>
      pureCircuits.assertSanctionScreeningResultPass(
        failed.credential,
        failed.presentation,
      ),
    ).toThrow(/Screening result is not PASS/);
    expect(() =>
      pureCircuits.assertSanctionScreeningPepFalse(
        pep.credential,
        pep.presentation,
      ),
    ).toThrow(/Credential subject is marked as PEP/);
  });

  it("validates freshness and expiry predicates", () => {
    const fixture = createSanctionScreeningFixture();

    expect(() =>
      pureCircuits.assertSanctionScreeningFresh(
        fixture.credential,
        fixture.presentation,
        fixture.witness.currentDay,
        fixture.witness.screeningDateDay,
        fixture.witness.screeningDateOpening,
      ),
    ).not.toThrow();
    expect(() =>
      pureCircuits.assertSanctionScreeningNotExpired(
        fixture.credential,
        fixture.witness.currentDay,
      ),
    ).not.toThrow();
  });

  it("rejects stale or expired screening credentials", () => {
    const stale = createSanctionScreeningFixture({ currentDay: 12_800n });
    const expired = createSanctionScreeningFixture({ currentDay: 13_000n });

    expect(() =>
      pureCircuits.assertSanctionScreeningFresh(
        stale.credential,
        stale.presentation,
        stale.witness.currentDay,
        stale.witness.screeningDateDay,
        stale.witness.screeningDateOpening,
      ),
    ).toThrow(/Screening result is older than the requested freshness window/);
    expect(() =>
      pureCircuits.assertSanctionScreeningNotExpired(
        expired.credential,
        expired.witness.currentDay,
      ),
    ).toThrow(/Sanction screening credential has expired/);
  });
});
