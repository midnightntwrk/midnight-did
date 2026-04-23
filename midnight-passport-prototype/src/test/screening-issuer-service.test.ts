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

describe("Screening issuer OID4VCI/OID4VP-shaped service", () => {
  it("creates a Screening presentation request and accepts a direct-post VP submission", () => {
    const wallet = walletWithNationalId();
    const service = new ScreeningIssuerService();

    const started = service.start({
      issuerOrigin: "http://screening.example",
      walletOrigin: "http://wallet.example/callback",
    });
    const request = service.getAuthorizationRequest(started.session.id);

    expect(started.session.checks.nationalIdPresentationVerified).toBe(false);
    expect(started.session.issuerDid).toBe(
      "did:midnight:prototype:screening-issuer",
    );
    expect(started.redirectUrl).toContain("request_uri=");

    const accepted = service.acceptAuthorizationResponse({
      requestId: request.id,
      response: wallet.createScreeningAuthorizationResponse(request.request),
    });

    expect(accepted.session.checks.nationalIdPresentationVerified).toBe(true);
    expect(accepted.redirectUrl).toContain("screening-issuer.html");
  });

  it("rejects a Screening direct-post when the submitted VP is not a National ID presentation", () => {
    const wallet = walletWithNationalId();
    const service = new ScreeningIssuerService();
    const started = service.start({
      issuerOrigin: "http://screening.example",
      walletOrigin: "http://wallet.example/callback",
    });
    const request = service.getAuthorizationRequest(started.session.id);
    const response = wallet.createScreeningAuthorizationResponse(request.request);

    expect(() =>
      service.acceptAuthorizationResponse({
        requestId: request.id,
        response: {
          ...response,
          vp_token: {
            ...(response.vp_token as Record<string, unknown>),
            schemaId: "not-national-id:v1",
          },
        },
      }),
    ).toThrow(/National ID presentation/);
  });

  it("rejects a Screening direct-post when VP holder binding does not match the presentation request", () => {
    const wallet = walletWithNationalId();
    const service = new ScreeningIssuerService();
    const started = service.start({
      issuerOrigin: "http://screening.example",
      walletOrigin: "http://wallet.example/callback",
    });
    const request = service.getAuthorizationRequest(started.session.id);
    const response = wallet.createScreeningAuthorizationResponse(request.request);

    expect(() =>
      service.acceptAuthorizationResponse({
        requestId: request.id,
        response: {
          ...response,
          vp_token: {
            ...(response.vp_token as Record<string, any>),
            holderBinding: {
              ...((response.vp_token as Record<string, any>).holderBinding ?? {}),
              challenge: "deadbeef",
            },
          },
        },
      }),
    ).toThrow(/challenge mismatch/);
  });

  it("rejects a Screening direct-post when the prototype witness does not satisfy the National ID presentation", () => {
    const wallet = walletWithNationalId();
    const service = new ScreeningIssuerService();
    const started = service.start({
      issuerOrigin: "http://screening.example",
      walletOrigin: "http://wallet.example/callback",
    });
    const request = service.getAuthorizationRequest(started.session.id);
    const response = wallet.createScreeningAuthorizationResponse(request.request);

    expect(() =>
      service.acceptAuthorizationResponse({
        requestId: request.id,
        response: {
          ...response,
          vp_token: {
            ...(response.vp_token as Record<string, any>),
            prototypeWitness: {
              ...((response.vp_token as Record<string, any>).prototypeWitness ??
                {}),
              passportOpening: sha256("tampered-passport-opening"),
            },
          },
        },
      }),
    ).toThrow();
  });

  it("rejects replay of the same Screening VP authorization response", () => {
    const wallet = walletWithNationalId();
    const service = new ScreeningIssuerService();
    const started = service.start({
      issuerOrigin: "http://screening.example",
      walletOrigin: "http://wallet.example/callback",
    });
    const request = service.getAuthorizationRequest(started.session.id);
    const response = wallet.createScreeningAuthorizationResponse(request.request);

    service.acceptAuthorizationResponse({
      requestId: request.id,
      response,
    });

    expect(() =>
      service.acceptAuthorizationResponse({
        requestId: request.id,
        response,
      }),
    ).toThrow(/already been used/);
  });

  it("exchanges a Screening credential offer without reading wallet inventory", () => {
    const wallet = walletWithNationalId();
    const service = new ScreeningIssuerService();
    const started = service.start({
      issuerOrigin: "http://screening.example",
      walletOrigin: "http://wallet.example/callback",
    });
    const request = service.getAuthorizationRequest(started.session.id);
    service.acceptAuthorizationResponse({
      requestId: request.id,
      response: wallet.createScreeningAuthorizationResponse(request.request),
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
