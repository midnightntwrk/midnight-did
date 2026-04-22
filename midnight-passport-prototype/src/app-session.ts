import type {
  CredentialRequest,
  CredentialResponse,
} from "@midnight-ntwrk/midnight-did-credentials-openid";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";

import { ComplianceIssuerAgent } from "./actors/compliance-issuer.js";
import { CryptoWalletStub } from "./actors/crypto-wallet.js";
import { MidnightPassportDapp } from "./actors/dapp.js";
import { InvestmentVerifierContractStub } from "./actors/investment-verifier.js";
import { NationalIdIssuerAgent } from "./actors/national-id-issuer.js";
import { MidnightPassportWallet } from "./actors/wallet.js";
import { InProcessWalletBridge } from "./bridge/wallet-bridge.js";
import { createPrototypePasskeyUnlockMaterial } from "./crypto/passkey.js";
import {
  NationalIdIssuerService,
  type NationalIdIssuerSessionState,
} from "./issuers/national-id-issuer-service.js";
import type {
  CryptoTransferReceipt,
  InvestmentDecision,
  InvestmentProduct,
  InvestmentProofBundle,
} from "./types.js";

const toHex = (value: Uint8Array): string =>
  [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");

export const defaultInvestmentProduct = (): InvestmentProduct => ({
  id: "private-growth-note",
  title: "Private Growth Note",
  minimumAgeYears: 18n,
  maxScreeningAgeDays: 60n,
  price: 250n,
});

export const passportPrototypeActions = [
  "reset",
  "initializeWallet",
  "lockWallet",
  "unlockWallet",
  "issueNationalId",
  "issueCompliance",
  "prepareProof",
  "approveProof",
  "settleInvestment",
  "runHappyPath",
  "runDeniedPath",
] as const;

export type PassportPrototypeAction = (typeof passportPrototypeActions)[number];

export type PrototypeActorState = {
  readonly walletInitialized: boolean;
  readonly walletUnlocked: boolean;
  readonly nationalIdIssued: boolean;
  readonly complianceIssued: boolean;
  readonly proofPrepared: boolean;
  readonly proofApproved: boolean;
  readonly transferSettled: boolean;
  readonly denied: boolean;
};

export type PrototypeActionState = Record<PassportPrototypeAction, boolean>;

export type PrototypeAppState = {
  readonly generatedAt: string;
  readonly mode: string;
  readonly wallet: {
    readonly profileId: string;
    readonly did: string;
    readonly displayName: string;
    readonly status: string;
    readonly passkeyCredentialId?: string;
    readonly walletSeedHash?: string;
  };
  readonly actors: PrototypeActorState;
  readonly actions: PrototypeActionState;
  readonly credentials: readonly {
    readonly label: string;
    readonly status: string;
    readonly details: string;
  }[];
  readonly disclosure: {
    readonly willProve: readonly string[];
    readonly willNotShare: readonly string[];
  };
  readonly investment: {
    readonly productId: string;
    readonly productTitle: string;
    readonly price: string;
    readonly approved: boolean;
    readonly decisionReason?: string;
    readonly participationCommitment?: string;
    readonly settlement?: {
      readonly from: string;
      readonly to: string;
      readonly amount: string;
      readonly txId: string;
    };
  };
  readonly protocol: {
    readonly issuerMessages: readonly string[];
    readonly verifierMessages: readonly string[];
  };
  readonly issuer?: {
    readonly nationalId?: NationalIdIssuerSessionState;
  };
  readonly events: readonly string[];
};

export const isPassportPrototypeAction = (
  value: string,
): value is PassportPrototypeAction =>
  (passportPrototypeActions as readonly string[]).includes(value);

export class PassportPrototypeSession {
  private readonly passkey = createPrototypePasskeyUnlockMaterial("alice");
  private readonly product = defaultInvestmentProduct();
  private readonly wallet = new MidnightPassportWallet("alice");
  private readonly walletBridge = new InProcessWalletBridge(this.wallet);
  private readonly nationalIdIssuer = new NationalIdIssuerService();
  private readonly verifier = new InvestmentVerifierContractStub(
    "midnight-treasury",
    this.product,
  );
  private readonly cryptoWallet = new CryptoWalletStub(
    "external-wallet-alice",
    1_000n,
  );
  private readonly dapp = new MidnightPassportDapp(
    this.verifier,
    this.walletBridge,
    this.cryptoWallet,
  );

  private mode = "Manual";
  private proof?: InvestmentProofBundle;
  private decision?: InvestmentDecision;
  private receipt?: CryptoTransferReceipt;
  private denied = false;
  private nationalIdIssuerSession?: NationalIdIssuerSessionState;
  private readonly events: string[] = [
    "Prototype reset. Start by initializing the wallet.",
    "No credential material has left the local wallet.",
  ];

  constructor() {
    setNetworkId("undeployed");
  }

  state(): PrototypeAppState {
    const status = this.walletBridge.status();
    const actors = this.actorState();
    const approved = this.decision?.approved === true;

    return {
      generatedAt: new Date().toISOString(),
      mode: this.mode,
      wallet: {
        profileId: status.profileId,
        did: status.did,
        displayName: status.displayName,
        status: status.initialized
          ? status.unlocked
            ? "Initialized and unlocked"
            : "Initialized and locked"
          : "Not initialized",
        passkeyCredentialId: status.passkeyCredentialId,
        walletSeedHash: status.walletSeedHash,
      },
      actors,
      actions: this.actionState(actors),
      credentials: [
        {
          label: "National ID proxy",
          status: status.credentials.nationalId ? "Issued" : "Not issued",
          details:
            "Age and expiry predicates available without sharing document fields.",
        },
        {
          label: "Compliance screening",
          status: status.credentials.compliance ? "Issued" : "Not issued",
          details:
            "PASS, PEP=false, freshness, and hidden-holder binding available.",
        },
      ],
      disclosure: {
        willProve: this.dapp.requestDisclosureSummary(),
        willNotShare: [
          "Passport number",
          "Legal name",
          "Birth date",
          "Holder DID",
          "Raw sanctions provider response",
        ],
      },
      investment: {
        productId: this.product.id,
        productTitle: this.product.title,
        price: this.product.price.toString(),
        approved,
        decisionReason:
          this.decision && !this.decision.approved
            ? this.decision.reason
            : undefined,
        participationCommitment:
          this.decision?.approved === true
            ? toHex(this.decision.participationCommitment)
            : undefined,
        settlement: this.receipt
          ? {
              from: this.receipt.from,
              to: this.receipt.to,
              amount: this.receipt.amount.toString(),
              txId: this.receipt.txId,
            }
          : undefined,
      },
      protocol: {
        issuerMessages: [
          this.walletBridge.status().credentials.nationalId
            ? "OID4VCI credential response accepted by wallet"
            : "Waiting for National ID issuer redirect",
          "issuer identified by Midnight DID and JubJub verification method",
          "OID4VCI credential offer URI",
          "pre-authorized token request",
          "credential request with blinded holder commitment",
          "Midnight Compact credential response",
        ],
        verifierMessages: [
          "OID4VP-style presentation definition",
          "verifier challenge",
          "wallet-built Midnight Compact VP bundle",
          "contract simulator decision",
        ],
      },
      issuer: this.nationalIdIssuerSession
        ? { nationalId: this.nationalIdIssuerSession }
        : undefined,
      events: [...this.events],
    };
  }

  beginNationalIdIssuance(input: {
    readonly issuerOrigin: string;
    readonly redirectUri: string;
  }): { readonly redirectUrl: string; readonly state: PrototypeAppState } {
    this.assertInitialized();
    this.assertWalletUnlocked();
    const result = this.nationalIdIssuer.start(input);
    this.nationalIdIssuerSession = result.session;
    this.addEvent(
      "National ID issuer redirect started: wallet sent the user to issuer checks.",
    );
    return { redirectUrl: result.redirectUrl, state: this.state() };
  }

  redeemNationalIdCredentialOffer(input: {
    readonly credentialOfferUri: string;
    readonly issuerSessionId?: string;
    readonly state?: string;
  }): PrototypeAppState {
    this.assertInitialized();
    this.assertWalletUnlocked();
    this.assertIssuerCallback(input);
    const issued = this.nationalIdIssuer.redeemOffer({
      credentialOfferUri: input.credentialOfferUri,
      holder: this.walletBridge.profile().holder,
    });
    this.walletBridge.acceptNationalIdCredential(issued.credential);
    this.addEvent(
      "Wallet redeemed OID4VCI credential offer, exchanged token and credential requests, and stored the Digital National ID credential.",
    );
    return this.state();
  }

  issueNationalIdCredentialFromProtocol(input: {
    readonly accessToken: string;
    readonly credentialRequest: CredentialRequest;
  }): CredentialResponse {
    this.assertInitialized();
    this.assertWalletUnlocked();
    const issued = this.nationalIdIssuer.issueCredential({
      accessToken: input.accessToken,
      request: input.credentialRequest,
      holder: this.walletBridge.profile().holder,
    });
    this.walletBridge.acceptNationalIdCredential(issued.credential);
    this.addEvent(
      "Wallet stored Digital National ID credential from issuer credential endpoint.",
    );
    return issued.response;
  }

  nationalIdIssuerApi(): NationalIdIssuerService {
    return this.nationalIdIssuer;
  }

  execute(
    action: Exclude<PassportPrototypeAction, "reset">,
  ): PrototypeAppState {
    switch (action) {
      case "initializeWallet":
        this.initializeWallet();
        break;
      case "lockWallet":
        this.lockWallet();
        break;
      case "unlockWallet":
        this.unlockWallet();
        break;
      case "issueNationalId":
        this.issueNationalId();
        break;
      case "issueCompliance":
        this.issueCompliance();
        break;
      case "prepareProof":
        this.prepareProof();
        break;
      case "approveProof":
        this.approveProof();
        break;
      case "settleInvestment":
        this.settleInvestment();
        break;
      case "runHappyPath":
        this.runHappyPath();
        break;
      case "runDeniedPath":
        this.runDeniedPath();
        break;
      default:
        action satisfies never;
    }

    return this.state();
  }

  initializeWallet(): void {
    if (this.walletBridge.status().initialized) return;
    this.walletBridge.initialize(this.passkey.prfOutput, {
      passkeyCredentialId: this.passkey.credentialId,
    });
    this.addEvent(
      "Wallet initialized: passkey-derived keys encrypted stores and a random Midnight wallet seed was generated.",
    );
  }

  lockWallet(): void {
    if (!this.walletBridge.status().initialized) return;
    this.walletBridge.lock();
    this.addEvent("Wallet session locked: encrypted stores remain sealed.");
  }

  unlockWallet(): void {
    this.assertInitialized();
    if (this.walletBridge.status().unlocked) return;
    this.walletBridge.unlock(this.passkey.prfOutput);
    this.addEvent(
      "Wallet session unlocked with passkey-derived material; secure storage is readable.",
    );
  }

  issueNationalId(): void {
    this.assertInitialized();
    if (this.walletBridge.status().credentials.nationalId) return;
    this.walletBridge.requestNationalIdCredential(new NationalIdIssuerAgent());
    this.addEvent(
      "National ID issuer created a passport proxy credential with hidden holder binding.",
    );
  }

  issueCompliance(): void {
    this.assertInitialized();
    if (this.walletBridge.status().credentials.compliance) return;
    this.walletBridge.requestComplianceCredential(
      new ComplianceIssuerAgent({ sanctioned: false, pep: false }),
    );
    this.addEvent(
      "Compliance issuer verified passport disclosure and issued PASS / PEP=false credential.",
    );
  }

  prepareProof(): void {
    if (this.proof) return;
    this.proof = this.walletBridge.createInvestmentProof(this.verifier);
    this.addEvent(
      "Wallet prepared verifier-scoped presentations from stored credentials.",
    );
  }

  approveProof(): void {
    if (this.decision) return;
    if (!this.proof) this.prepareProof();
    if (!this.proof) throw new Error("Investment proof was not prepared");
    this.decision = this.verifier.verify(
      this.proof,
      this.walletBridge.profile(),
    );
    this.addEvent(
      this.decision.approved
        ? "Private proof approved: verifier accepted age, compliance, freshness, and same-holder predicates."
        : `Private proof denied: ${this.decision.reason}`,
    );
  }

  settleInvestment(): void {
    if (this.receipt) return;
    if (!this.decision) this.approveProof();
    if (!this.decision) throw new Error("Investment decision was not created");
    this.receipt = this.verifier.settle({
      decision: this.decision,
      wallet: this.cryptoWallet,
    });
    this.addEvent(
      `External crypto wallet transferred ${this.receipt.amount} units to ${this.receipt.to}.`,
    );
  }

  runHappyPath(): void {
    this.mode = "Happy path";
    this.initializeWallet();
    this.unlockWallet();
    this.issueNationalId();
    this.issueCompliance();
    this.prepareProof();
    this.approveProof();
    this.settleInvestment();
  }

  runDeniedPath(): void {
    this.mode = "Denied path";
    this.initializeWallet();
    this.unlockWallet();
    this.issueNationalId();
    try {
      this.walletBridge.requestComplianceCredential(
        new ComplianceIssuerAgent({ sanctioned: true, pep: false }),
      );
    } catch (error) {
      this.denied = true;
      this.addEvent(
        `Compliance issuer denied issuance: ${
          error instanceof Error ? error.message : "unknown screening error"
        }.`,
      );
    }
  }

  private actorState(): PrototypeActorState {
    const status = this.walletBridge.status();
    return {
      walletInitialized: status.initialized,
      walletUnlocked: status.unlocked,
      nationalIdIssued: status.credentials.nationalId,
      complianceIssued: status.credentials.compliance,
      proofPrepared: Boolean(this.proof),
      proofApproved: this.decision?.approved === true,
      transferSettled: Boolean(this.receipt),
      denied: this.denied || this.decision?.approved === false,
    };
  }

  private actionState(actors: PrototypeActorState): PrototypeActionState {
    return {
      reset: true,
      initializeWallet: !actors.walletInitialized,
      lockWallet: actors.walletInitialized && actors.walletUnlocked,
      unlockWallet: actors.walletInitialized && !actors.walletUnlocked,
      issueNationalId:
        actors.walletInitialized &&
        actors.walletUnlocked &&
        !actors.nationalIdIssued &&
        !actors.denied,
      issueCompliance:
        actors.walletUnlocked &&
        actors.nationalIdIssued &&
        !actors.complianceIssued &&
        !actors.denied,
      prepareProof:
        actors.walletUnlocked &&
        actors.complianceIssued &&
        !actors.proofPrepared &&
        !actors.denied,
      approveProof:
        actors.walletUnlocked &&
        actors.proofPrepared &&
        !actors.proofApproved &&
        !actors.denied,
      settleInvestment:
        actors.walletUnlocked &&
        actors.proofApproved &&
        !actors.transferSettled &&
        !actors.denied,
      runHappyPath:
        (!actors.walletInitialized || actors.walletUnlocked) &&
        !actors.transferSettled,
      runDeniedPath:
        (!actors.walletInitialized || actors.walletUnlocked) &&
        !actors.denied &&
        !actors.complianceIssued,
    };
  }

  private assertInitialized(): void {
    if (!this.walletBridge.status().initialized) {
      throw new Error("Wallet must be initialized first");
    }
  }

  private assertWalletUnlocked(): void {
    if (!this.walletBridge.status().unlocked) {
      throw new Error("Wallet session must be unlocked first");
    }
  }

  private assertIssuerCallback(input: {
    readonly issuerSessionId?: string;
    readonly state?: string;
  }): void {
    if (!this.nationalIdIssuerSession) {
      throw new Error("National ID issuer session was not started");
    }
    if (
      input.issuerSessionId &&
      input.issuerSessionId !== this.nationalIdIssuerSession.id
    ) {
      throw new Error("National ID issuer session mismatch");
    }
    if (input.state && input.state !== this.nationalIdIssuerSession.state) {
      throw new Error("National ID issuer state mismatch");
    }
  }

  private addEvent(text: string): void {
    this.events.unshift(text);
  }
}

export const createPrototypeAppState = (): PrototypeAppState => {
  const session = new PassportPrototypeSession();
  session.runHappyPath();
  return session.state();
};
