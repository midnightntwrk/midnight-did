import { describe, expect, it } from "vitest";

import {
  decodeSanctionScreeningCredential,
  decodeSanctionScreeningPresentation,
  decodeSanctionScreeningProof,
  encodeSanctionScreeningCredential,
  encodeSanctionScreeningPresentation,
  encodeSanctionScreeningProof,
} from "../codecs.js";
import { createSanctionScreeningFixture } from "../fixtures/credential-fixtures.js";

describe("sanction screening credential codecs", () => {
  it("round-trips credential, presentation, and proof payloads", () => {
    const fixture = createSanctionScreeningFixture();

    expect(
      decodeSanctionScreeningCredential(
        encodeSanctionScreeningCredential(fixture.credential),
      ),
    ).toEqual(fixture.credential);
    expect(
      decodeSanctionScreeningPresentation(
        encodeSanctionScreeningPresentation(fixture.presentation),
      ),
    ).toEqual(fixture.presentation);
    expect(
      decodeSanctionScreeningProof(
        encodeSanctionScreeningProof(fixture.credentialProof),
      ),
    ).toEqual(fixture.credentialProof);
  });
});
