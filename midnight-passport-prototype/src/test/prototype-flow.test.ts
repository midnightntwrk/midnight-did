import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { ComplianceIssuerAgent } from "../actors/compliance-issuer.js";
import { CryptoWalletStub } from "../actors/crypto-wallet.js";
import { MidnightPassportDapp } from "../actors/dapp.js";
import { InvestmentVerifierContractStub } from "../actors/investment-verifier.js";
import { NationalIdIssuerAgent } from "../actors/national-id-issuer.js";
import { MidnightPassportWallet } from "../actors/wallet.js";
import { InProcessWalletBridge } from "../bridge/wallet-bridge.js";
import { sha256 } from "../crypto/secure-store.js";
import { runHappyPathPrototype } from "../flow.js";

setNetworkId("undeployed");

const createVerifier = () =>
  new InvestmentVerifierContractStub("midnight-treasury", {
    id: "private-growth-note",
    title: "Private Growth Note",
    minimumAgeYears: 18n,
    maxScreeningAgeDays: 60n,
    price: 250n,
  });

const initWallet = (
  wallet: MidnightPassportWallet,
  profileId = "alice",
): Uint8Array => {
  const passkeyPrfOutput = sha256(`passkey-prf:${profileId}:device-1`);
  wallet.initialize(passkeyPrfOutput, {
    passkeyCredentialId: `passkey:${profileId}:device-1`,
    walletSeed: sha256(`wallet-seed:${profileId}:test`),
  });
  return passkeyPrfOutput;
};

const initBridge = (
  bridge: InProcessWalletBridge,
  profileId = "alice",
): Uint8Array => {
  const passkeyPrfOutput = sha256(`passkey-prf:${profileId}:device-1`);
  bridge.initialize(passkeyPrfOutput, {
    passkeyCredentialId: `passkey:${profileId}:device-1`,
    walletSeed: sha256(`wallet-seed:${profileId}:test`),
  });
  return passkeyPrfOutput;
};

describe("Midnight Passport prototype flow", () => {
  it("runs wallet initialization, issuance, verification, and settlement", () => {
    const result = runHappyPathPrototype();

    expect(result.decision.approved).toBe(true);
    expect(result.receipt?.amount).toBe(250n);
    expect(result.receipt?.to).toBe("midnight-treasury");
  });

  it("runs investment submission through the wallet bridge boundary", () => {
    const wallet = new MidnightPassportWallet("alice");
    const bridge = new InProcessWalletBridge(wallet);
    initBridge(bridge);
    bridge.requestNationalIdCredential(new NationalIdIssuerAgent());
    bridge.requestComplianceCredential(
      new ComplianceIssuerAgent({ sanctioned: false, pep: false }),
    );

    const dapp = new MidnightPassportDapp(
      createVerifier(),
      bridge,
      new CryptoWalletStub("external-wallet-alice", 1_000n),
    );
    const summary = dapp.requestDisclosureSummary();
    const result = dapp.submitApprovedProof();

    expect(bridge.status()).toMatchObject({
      initialized: true,
      unlocked: true,
      credentials: { nationalId: true, compliance: true },
    });
    expect(summary.join(" ")).toMatch(/same hidden holder/i);
    expect(result.decision.approved).toBe(true);
    expect(result.receipt?.amount).toBe(250n);
  });

  it("keeps the DApp behind the wallet bridge when credentials are missing", () => {
    const wallet = new MidnightPassportWallet("alice");
    const bridge = new InProcessWalletBridge(wallet);
    initBridge(bridge);
    const dapp = new MidnightPassportDapp(
      createVerifier(),
      bridge,
      new CryptoWalletStub("external-wallet-alice", 1_000n),
    );

    expect(() => dapp.submitApprovedProof()).toThrow(/National ID credential/);
  });

  it("denies compliance issuance when sanctions screening fails", () => {
    const wallet = new MidnightPassportWallet("sanctioned-alice");
    initWallet(wallet, "sanctioned-alice");
    wallet.requestNationalIdCredential(new NationalIdIssuerAgent());

    expect(() =>
      wallet.requestComplianceCredential(
        new ComplianceIssuerAgent({ sanctioned: true, pep: false }),
      ),
    ).toThrow(/Sanctions screening failed/);
  });

  it("requires an unlocked wallet session before issuing or proving credentials", () => {
    const wallet = new MidnightPassportWallet("alice");
    const passkeyPrfOutput = initWallet(wallet);
    expect(wallet.isUnlocked()).toBe(true);

    wallet.lock();
    expect(wallet.isUnlocked()).toBe(false);
    expect(() =>
      wallet.requestNationalIdCredential(new NationalIdIssuerAgent()),
    ).toThrow(/locked/);

    expect(() => wallet.unlock(sha256("wrong-passkey"))).toThrow();
    expect(wallet.isUnlocked()).toBe(false);

    wallet.unlock(passkeyPrfOutput);
    expect(wallet.isUnlocked()).toBe(true);
    wallet.requestNationalIdCredential(new NationalIdIssuerAgent());
    wallet.requestComplianceCredential(
      new ComplianceIssuerAgent({ sanctioned: false, pep: false }),
    );

    wallet.lock();
    expect(() => wallet.createInvestmentProof(createVerifier())).toThrow(
      /locked/,
    );
  });

  it("uses fresh store encryption IVs for each wallet initialization", () => {
    const firstWallet = new MidnightPassportWallet("alice");
    const secondWallet = new MidnightPassportWallet("alice");

    const firstStores = firstWallet.initialize(sha256("passkey-prf"), {
      passkeyCredentialId: "passkey:alice:device-1",
      walletSeed: sha256("wallet-seed:alice:test"),
    });
    const secondStores = secondWallet.initialize(sha256("passkey-prf"), {
      passkeyCredentialId: "passkey:alice:device-1",
      walletSeed: sha256("wallet-seed:alice:test"),
    });

    expect(firstStores.secretStore.iv).not.toEqual(secondStores.secretStore.iv);
    expect(firstStores.vcStore.iv).not.toEqual(secondStores.vcStore.iv);
  });

  it("denies investment proof when passport and compliance credentials belong to different hidden holders", () => {
    const wallet = new MidnightPassportWallet("alice");
    initWallet(wallet);
    wallet.requestNationalIdCredential(new NationalIdIssuerAgent());
    wallet.requestComplianceCredential(
      new ComplianceIssuerAgent({ sanctioned: false, pep: false }),
    );

    const verifier = createVerifier();
    const proof = wallet.createInvestmentProof(verifier);
    const mismatchedWallet = new MidnightPassportWallet("mallory");
    const decision = verifier.verify(proof, mismatchedWallet.profile);

    expect(decision.approved).toBe(false);
    if (decision.approved) {
      throw new Error("Expected verifier to deny mismatched holder proof");
    }
    expect(decision.reason).toMatch(/holder/i);
  });

  it("creates investment presentations from issued wallet credentials", () => {
    const wallet = new MidnightPassportWallet("alice");
    initWallet(wallet);
    wallet.requestNationalIdCredential(new NationalIdIssuerAgent());
    wallet.requestComplianceCredential(
      new ComplianceIssuerAgent({ sanctioned: false, pep: false }),
    );

    const inventory = wallet.credentialInventory();
    const verifier = createVerifier();
    const proof = wallet.createInvestmentProof(verifier);

    expect(proof.nationalId.credential).toBe(inventory.nationalId?.credential);
    expect(proof.nationalId.credentialProof).toBe(
      inventory.nationalId?.credentialProof,
    );
    expect(proof.compliance.credential).toBe(inventory.compliance?.credential);
    expect(proof.compliance.credentialProof).toBe(
      inventory.compliance?.credentialProof,
    );
    expect(proof.nationalId.presentation).not.toBe(
      inventory.nationalId?.presentation,
    );
    expect(proof.compliance.presentation).not.toBe(
      inventory.compliance?.presentation,
    );
    expect(proof.nationalId.presentationRequest.verifierChallengeHash).toEqual(
      proof.verifierChallengeHash,
    );
    expect(proof.compliance.presentationRequest.verifierChallengeHash).toEqual(
      proof.verifierChallengeHash,
    );
  });

  it("denies investment proof when a presentation threshold is tampered", () => {
    const wallet = new MidnightPassportWallet("alice");
    initWallet(wallet);
    wallet.requestNationalIdCredential(new NationalIdIssuerAgent());
    wallet.requestComplianceCredential(
      new ComplianceIssuerAgent({ sanctioned: false, pep: false }),
    );

    const verifier = createVerifier();
    const proof = wallet.createInvestmentProof(verifier);
    const decision = verifier.verify(
      {
        ...proof,
        nationalId: {
          ...proof.nationalId,
          presentation: {
            ...proof.nationalId.presentation,
            disclosed: {
              ...proof.nationalId.presentation.disclosed,
              ageThresholdYears: 21n,
            },
          },
        },
      },
      wallet.profile,
    );

    expect(decision.approved).toBe(false);
    if (decision.approved) {
      throw new Error("Expected verifier to deny mismatched threshold proof");
    }
    expect(decision.reason).toMatch(/threshold/);
  });

  it("does not settle when external crypto wallet has insufficient funds", () => {
    const wallet = new MidnightPassportWallet("alice");
    initWallet(wallet);
    wallet.requestNationalIdCredential(new NationalIdIssuerAgent());
    wallet.requestComplianceCredential(
      new ComplianceIssuerAgent({ sanctioned: false, pep: false }),
    );

    const verifier = createVerifier();
    const decision = verifier.verify(
      wallet.createInvestmentProof(verifier),
      wallet.profile,
    );
    const cryptoWallet = new CryptoWalletStub("external-wallet-alice", 10n);

    expect(decision.approved).toBe(true);
    expect(() => verifier.settle({ decision, wallet: cryptoWallet })).toThrow(
      /Insufficient external wallet balance/,
    );
  });
});
