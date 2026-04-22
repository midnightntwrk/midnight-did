import { describe, expect, it } from "vitest";

import {
  decodeSecretPassportCredential,
  decodeSecretPassportPresentation,
  decodeSecretPassportProof,
  encodeSecretPassportCredential,
  encodeSecretPassportPresentation,
  encodeSecretPassportProof,
} from "../codecs.js";
import { createSecretPassportCredentialFixture } from "../fixtures/credential-fixtures.js";

describe("secret passport credential codecs", () => {
  it("round-trips credential, presentation, and proof payloads", () => {
    const fixture = createSecretPassportCredentialFixture();

    expect(
      decodeSecretPassportCredential(
        encodeSecretPassportCredential(fixture.credential),
      ),
    ).toEqual(fixture.credential);
    expect(
      decodeSecretPassportPresentation(
        encodeSecretPassportPresentation(fixture.presentation),
      ),
    ).toEqual(fixture.presentation);
    expect(
      decodeSecretPassportProof(
        encodeSecretPassportProof(fixture.credentialProof),
      ),
    ).toEqual(fixture.credentialProof);
  });
});
