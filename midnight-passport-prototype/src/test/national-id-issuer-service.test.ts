import { describe, expect, it } from "vitest";

import { sha256 } from "../crypto/secure-store.js";
import { NationalIdIssuerService } from "../issuers/national-id-issuer-service.js";
import type { HolderSecretMaterial } from "../types.js";

const holder = (): HolderSecretMaterial => ({
  holderSecret: sha256("holder-secret:oid4vci"),
  passportOpening: sha256("holder-opening:passport"),
  passportBlindingFactor: sha256("holder-blinding:passport"),
  complianceOpening: sha256("holder-opening:compliance"),
  complianceBlindingFactor: sha256("holder-blinding:compliance"),
});

describe("National ID issuer OID4VCI-shaped service", () => {
  it("requires mocked issuer checks before returning a credential offer", () => {
    const service = new NationalIdIssuerService();
    const started = service.start({
      issuerOrigin: "http://issuer.example",
      redirectUri: "http://wallet.example/callback",
    });

    expect(() => service.completeChecks(started.session.id)).toThrow(
      /checks must pass/,
    );

    service.setCheck({
      sessionId: started.session.id,
      check: "documentsUploaded",
      value: true,
    });
    service.setCheck({
      sessionId: started.session.id,
      check: "livenessPassed",
      value: true,
    });
    service.setCheck({
      sessionId: started.session.id,
      check: "profileApproved",
      value: true,
    });

    const completed = service.completeChecks(started.session.id);

    expect(started.session.issuerDid).toBe(
      "did:midnight:prototype:national-id-issuer",
    );
    expect(started.session.issuerMethodId).toMatch(/^0x[0-9a-f]+$/u);
    expect(completed.redirectUrl).toContain("credential_offer_uri=");
    expect(completed.session.status).toBe("offer_issued");
  });

  it("exchanges offer, token request, and credential request for a Compact credential response", () => {
    const service = new NationalIdIssuerService();
    const started = service.start({
      issuerOrigin: "http://issuer.example",
      redirectUri: "http://wallet.example/callback",
    });
    service.setCheck({
      sessionId: started.session.id,
      check: "documentsUploaded",
      value: true,
    });
    service.setCheck({
      sessionId: started.session.id,
      check: "livenessPassed",
      value: true,
    });
    service.setCheck({
      sessionId: started.session.id,
      check: "profileApproved",
      value: true,
    });
    const completed = service.completeChecks(started.session.id);

    if (!completed.session.credentialOfferUri) {
      throw new Error("Expected credential offer URI");
    }

    const tokenRequest = service.createTokenRequest(
      completed.session.credentialOfferUri,
    );
    const token = service.exchangeToken(tokenRequest);
    const credentialRequest = service.createCredentialRequest({
      holder: holder(),
      token,
    });
    const issued = service.issueCredential({
      accessToken: token.access_token,
      request: credentialRequest,
      holder: holder(),
    });

    expect(issued.credential.issuer.verificationMethodRef).toEqual(
      service.issuerIdentity().signer.verificationMethodRef,
    );
    expect(token.token_type).toBe("Bearer");
    expect(credentialRequest.midnight?.holderBinding.method).toBe(
      "blinded_secret_commitment",
    );
    expect(issued.response.credential).toMatchObject({
      format: "midnight_compact_vc",
      credentialFamily: "passport-secret",
    });
  });
});
