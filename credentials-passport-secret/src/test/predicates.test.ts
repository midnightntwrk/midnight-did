import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { pureCircuits } from "../managed/secret-passport-credential/contract/index.js";
import { createSecretPassportCredentialFixture } from "./credential-fixtures.js";

setNetworkId("undeployed");

describe("secret passport credential: predicates", () => {
  it("validates age predicate with secret passport credential", () => {
    const fixture = createSecretPassportCredentialFixture();

    expect(() =>
      pureCircuits.assertValidSecretPassportCredentialAgePredicate(
        fixture.credential,
        fixture.presentation,
        fixture.witness.currentDay,
        fixture.witness.birthDateDays,
        fixture.witness.birthDateOpening,
      ),
    ).not.toThrow();
  });

  it("validates not-expired predicate with secret passport credential", () => {
    const fixture = createSecretPassportCredentialFixture();

    expect(() =>
      pureCircuits.assertSecretPassportNotExpired(
        fixture.credential,
        fixture.witness.currentDay,
      ),
    ).not.toThrow();

    expect(() =>
      pureCircuits.assertSecretPassportNotExpired(
        fixture.credential,
        fixture.witness.expiryDate + 1n,
      ),
    ).toThrow(/Passport has expired/);
  });
});
