import { URL } from "node:url";

import { describe, expect, it } from "vitest";

import { PassportPrototypeSession } from "../app-session.js";

describe("Midnight Passport browser session backend", () => {
  it("drives the full browser flow through real prototype actors", () => {
    const session = new PassportPrototypeSession();

    expect(session.state().actions.issueNationalId).toBe(false);

    session.execute("initializeWallet");
    expect(session.state()).toMatchObject({
      actors: { walletInitialized: true, walletUnlocked: true },
    });
    expect(session.state().wallet.passkeyCredentialId).toBe(
      "passkey:alice:device-1",
    );
    expect(session.state().wallet.walletSeedHash).toMatch(/^[0-9a-f]{64}$/u);

    session.execute("issueNationalId");
    session.execute("issueCompliance");
    session.execute("prepareProof");
    session.execute("approveProof");
    session.execute("settleInvestment");

    const state = session.state();
    expect(state.actors).toMatchObject({
      nationalIdIssued: true,
      complianceIssued: true,
      proofPrepared: true,
      proofApproved: true,
      transferSettled: true,
    });
    expect(state.investment.approved).toBe(true);
    expect(state.investment.settlement).toMatchObject({
      to: "midnight-treasury",
      amount: "250",
    });
  });

  it("blocks out-of-order issuance until the wallet is initialized", () => {
    const session = new PassportPrototypeSession();

    expect(() => session.execute("issueNationalId")).toThrow(
      /Wallet must be initialized first/,
    );
    expect(session.state().actions.issueCompliance).toBe(false);
  });

  it("requires passkey unlock before issuance can continue", () => {
    const session = new PassportPrototypeSession();

    session.execute("initializeWallet");
    session.execute("lockWallet");

    expect(session.state().actors.walletUnlocked).toBe(false);
    expect(session.state().actions.issueNationalId).toBe(false);
    expect(session.state().actions.runHappyPath).toBe(false);
    expect(() => session.execute("issueNationalId")).toThrow(/locked/);
    expect(() =>
      session.beginNationalIdIssuance({
        issuerOrigin: "http://issuer.example",
        redirectUri: "http://wallet.example/",
      }),
    ).toThrow(/unlocked/);

    session.execute("unlockWallet");

    expect(session.state().actors.walletUnlocked).toBe(true);
    expect(session.state().actions.issueNationalId).toBe(true);
  });

  it("accepts Digital National ID through issuer redirect and credential offer redemption", () => {
    const session = new PassportPrototypeSession();
    session.execute("initializeWallet");
    const started = session.beginNationalIdIssuance({
      issuerOrigin: "http://issuer.example",
      redirectUri: "http://wallet.example/",
    });
    const issuer = session.nationalIdIssuerApi();
    const sessionId = started.state.issuer?.nationalId?.id;
    expect(started.state.issuer?.nationalId?.issuerDid).toBe(
      "did:midnight:prototype:national-id-issuer",
    );
    if (!sessionId) {
      throw new Error("Expected National ID issuer session");
    }

    issuer.setCheck({
      sessionId,
      check: "documentsUploaded",
      value: true,
    });
    issuer.setCheck({
      sessionId,
      check: "livenessPassed",
      value: true,
    });
    issuer.setCheck({
      sessionId,
      check: "profileApproved",
      value: true,
    });
    const completed = issuer.completeChecks(sessionId);

    if (!completed.session.credentialOfferUri) {
      throw new Error("Expected credential offer URI");
    }

    const redirect = new URL(completed.redirectUrl);
    const state = session.redeemNationalIdCredentialOffer({
      credentialOfferUri: completed.session.credentialOfferUri,
      issuerSessionId: redirect.searchParams.get("issuer_session") ?? undefined,
      state: redirect.searchParams.get("state") ?? undefined,
    });

    expect(state.actors.nationalIdIssued).toBe(true);
    expect(state.events[0]).toMatch(/redeemed OID4VCI credential offer/);
  });

  it("models the denied compliance path without creating a proof", () => {
    const session = new PassportPrototypeSession();

    session.execute("runDeniedPath");

    const state = session.state();
    expect(state.mode).toBe("Denied path");
    expect(state.actors).toMatchObject({
      walletInitialized: true,
      nationalIdIssued: true,
      complianceIssued: false,
      proofPrepared: false,
      denied: true,
    });
    expect(state.events[0]).toMatch(/Compliance issuer denied issuance/);
  });
});
