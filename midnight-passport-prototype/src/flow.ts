import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";

import { ComplianceIssuerAgent } from "./actors/compliance-issuer.js";
import { CryptoWalletStub } from "./actors/crypto-wallet.js";
import { MidnightPassportDapp } from "./actors/dapp.js";
import { InvestmentVerifierContractStub } from "./actors/investment-verifier.js";
import { NationalIdIssuerAgent } from "./actors/national-id-issuer.js";
import { MidnightPassportWallet } from "./actors/wallet.js";
import { InProcessWalletBridge } from "./bridge/wallet-bridge.js";
import { createPrototypePasskeyUnlockMaterial } from "./crypto/passkey.js";
import type {
  CryptoTransferReceipt,
  InvestmentDecision,
  InvestmentProduct,
} from "./types.js";

export type PassportPrototypeResult = {
  readonly profile: {
    readonly id: string;
    readonly displayName: string;
  };
  readonly product: InvestmentProduct;
  readonly decision: InvestmentDecision;
  readonly receipt?: CryptoTransferReceipt;
  readonly events: readonly string[];
};

export const runHappyPathPrototype = (): PassportPrototypeResult => {
  setNetworkId("undeployed");

  const events: string[] = [];
  const wallet = new MidnightPassportWallet("alice");
  const walletBridge = new InProcessWalletBridge(wallet);
  const passkey = createPrototypePasskeyUnlockMaterial("alice");
  walletBridge.initialize(passkey.prfOutput, {
    passkeyCredentialId: passkey.credentialId,
  });
  walletBridge.unlock(passkey.prfOutput);
  events.push(
    "Wallet stores initialized and readable from passkey-derived keys.",
  );

  walletBridge.requestNationalIdCredential(new NationalIdIssuerAgent());
  events.push(
    "National ID proxy credential issued with blinded holder binding.",
  );

  walletBridge.requestComplianceCredential(
    new ComplianceIssuerAgent({ sanctioned: false, pep: false }),
  );
  events.push(
    "Compliance credential issued after passport disclosure screening.",
  );

  const product: InvestmentProduct = {
    id: "private-growth-note",
    title: "Private Growth Note",
    minimumAgeYears: 18n,
    maxScreeningAgeDays: 60n,
    price: 250n,
  };
  const verifier = new InvestmentVerifierContractStub(
    "midnight-treasury",
    product,
  );
  const cryptoWallet = new CryptoWalletStub("external-wallet-alice", 1_000n);
  const dapp = new MidnightPassportDapp(verifier, walletBridge, cryptoWallet);
  events.push(
    `DApp requested disclosure summary: ${dapp.requestDisclosureSummary().join("; ")}.`,
  );
  const { decision, receipt } = dapp.submitApprovedProof();
  events.push(
    decision.approved
      ? "Investment verifier accepted age, compliance, freshness, and same-holder predicates."
      : `Investment verifier denied proof: ${decision.reason}`,
  );
  if (receipt) {
    events.push(
      `External crypto wallet transferred ${receipt.amount} units to ${receipt.to}.`,
    );
  }

  return {
    profile: {
      id: walletBridge.profile().id,
      displayName: walletBridge.profile().displayName,
    },
    product,
    decision,
    receipt,
    events,
  };
};
