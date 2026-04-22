import { describe, expect, it } from "vitest";

import { NationalIdIssuerAgent } from "../actors/national-id-issuer.js";
import { MidnightPassportWallet } from "../actors/wallet.js";
import { sha256 } from "../crypto/secure-store.js";
import { ScreeningIssuerService } from "../issuers/screening-issuer-service.js";

const walletWithNationalId = (): MidnightPassportWallet => {
  const wallet = new MidnightPassportWallet("alice");
  wallet.initialize(sha256("passkey-prf:alice"), {
    passkeyCredentialId: "passkey:alice:test",
  });
  wallet.requestNationalIdCredential(new NationalIdIssuerAgent());
  return wallet;
};

describe("Screening issuer OID4VCI-shaped service", () => {
  it("requires an explicit National ID VP submission before screening", () => {
    const wallet = walletWithNationalId();
    const service = new ScreeningIssuerService();
    const presentation = wallet.createNationalIdPresentationForScreening();

    const started = service.start({
      issuerOrigin: "http://screening.example",
      redirectUri: "http://wallet.example/callback",
      nationalIdPresentation: presentation,
    });

    expect(started.session.checks.nationalIdPresentationVerified).toBe(true);
    expect(started.session.issuerDid).toBe(
      "did:midnight:prototype:screening-issuer",
    );
    expect(started.redirectUrl).toContain("screening-issuer.html");
  });

  it("rejects a Screening flow when the submitted VP is not a National ID presentation", () => {
    const wallet = walletWithNationalId();
    const service = new ScreeningIssuerService();
    const presentation = wallet.createNationalIdPresentationForScreening();

    expect(() =>
      service.start({
        issuerOrigin: "http://screening.example",
        redirectUri: "http://wallet.example/callback",
        nationalIdPresentation: {
          ...presentation,
          vpToken: {
            ...presentation.vpToken,
            schemaId:
              "not-national-id:v1" as typeof presentation.vpToken.schemaId,
          },
        },
      }),
    ).toThrow(/National ID presentation/);
  });

  it("rejects a Screening flow when VP holder binding does not match the presentation request", () => {
    const wallet = walletWithNationalId();
    const service = new ScreeningIssuerService();
    const presentation = wallet.createNationalIdPresentationForScreening();

    expect(() =>
      service.start({
        issuerOrigin: "http://screening.example",
        redirectUri: "http://wallet.example/callback",
        nationalIdPresentation: {
          ...presentation,
          vpToken: {
            ...presentation.vpToken,
            holderBinding: {
              ...presentation.vpToken.holderBinding,
              challenge: "deadbeef",
            },
          },
        },
      }),
    ).toThrow(/challenge mismatch/);
  });

  it("exchanges a Screening credential offer without reading wallet inventory", () => {
    const wallet = walletWithNationalId();
    const service = new ScreeningIssuerService();
    const started = service.start({
      issuerOrigin: "http://screening.example",
      redirectUri: "http://wallet.example/callback",
      nationalIdPresentation: wallet.createNationalIdPresentationForScreening(),
    });

    for (const check of [
      "sanctionsChecked",
      "pepChecked",
      "profileApproved",
    ] as const) {
      service.setCheck({ sessionId: started.session.id, check, value: true });
    }
    const completed = service.completeChecks(started.session.id);
    if (!completed.session.credentialOfferUri) {
      throw new Error("Expected Screening credential offer URI");
    }

    const issued = service.redeemOffer({
      credentialOfferUri: completed.session.credentialOfferUri,
      holder: wallet.profile.holder,
    });

    expect(issued.response.credential).toMatchObject({
      format: "midnight_compact_vc",
      credentialFamily: "sanction-screening",
    });
    expect(issued.credential.issuer.verificationMethodRef).toEqual(
      service.issuerIdentity().signer.verificationMethodRef,
    );
  });
});
