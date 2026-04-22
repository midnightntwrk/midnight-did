import type { PassportCredentialFixture } from "@midnight-ntwrk/midnight-did-credentials-passport-secret";

import type { ComplianceIssuerAgent } from "../actors/compliance-issuer.js";
import type { InvestmentVerifierContractStub } from "../actors/investment-verifier.js";
import type { NationalIdIssuerAgent } from "../actors/national-id-issuer.js";
import type {
  MidnightPassportWallet,
  WalletInitializationOptions,
} from "../actors/wallet.js";
import type {
  ComplianceCredentialFixture,
  InvestmentProofBundle,
  WalletCredentialInventory,
  WalletProfile,
} from "../types.js";

export type WalletBridgeStatus = {
  readonly profileId: string;
  readonly displayName: string;
  readonly did: string;
  readonly initialized: boolean;
  readonly unlocked: boolean;
  readonly passkeyCredentialId?: string;
  readonly walletSeedHash?: string;
  readonly credentials: {
    readonly nationalId: boolean;
    readonly compliance: boolean;
  };
};

export interface WalletBridge {
  status(): WalletBridgeStatus;
  profile(): WalletProfile;
  inventory(): WalletCredentialInventory;
  initialize(
    passkeyPrfOutput: Uint8Array,
    options: WalletInitializationOptions,
  ): void;
  lock(): void;
  unlock(passkeyPrfOutput: Uint8Array): void;
  requestNationalIdCredential(issuer: NationalIdIssuerAgent): void;
  acceptNationalIdCredential(credential: PassportCredentialFixture): void;
  requestComplianceCredential(issuer: ComplianceIssuerAgent): void;
  acceptComplianceCredential(credential: ComplianceCredentialFixture): void;
  createInvestmentProof(
    verifier: InvestmentVerifierContractStub,
  ): InvestmentProofBundle;
}

export class InProcessWalletBridge implements WalletBridge {
  private initialized = false;

  constructor(private readonly wallet: MidnightPassportWallet) {}

  status(): WalletBridgeStatus {
    const inventory = this.wallet.credentialInventory();
    return {
      profileId: this.wallet.profile.id,
      displayName: this.wallet.profile.displayName,
      did: this.wallet.profile.did,
      initialized: this.initialized,
      unlocked: this.wallet.isUnlocked(),
      passkeyCredentialId: this.wallet.profile.passkeyCredentialId,
      walletSeedHash: this.wallet.profile.walletSeedHash,
      credentials: {
        nationalId: Boolean(inventory.nationalId),
        compliance: Boolean(inventory.compliance),
      },
    };
  }

  profile(): WalletProfile {
    return this.wallet.profile;
  }

  inventory(): WalletCredentialInventory {
    return this.wallet.credentialInventory();
  }

  initialize(
    passkeyPrfOutput: Uint8Array,
    options: WalletInitializationOptions,
  ): void {
    this.wallet.initialize(passkeyPrfOutput, options);
    this.initialized = true;
  }

  lock(): void {
    this.wallet.lock();
  }

  unlock(passkeyPrfOutput: Uint8Array): void {
    this.wallet.unlock(passkeyPrfOutput);
  }

  requestNationalIdCredential(issuer: NationalIdIssuerAgent): void {
    this.wallet.requestNationalIdCredential(issuer);
  }

  acceptNationalIdCredential(credential: PassportCredentialFixture): void {
    this.wallet.acceptNationalIdCredential(credential);
  }

  requestComplianceCredential(issuer: ComplianceIssuerAgent): void {
    this.wallet.requestComplianceCredential(issuer);
  }

  acceptComplianceCredential(credential: ComplianceCredentialFixture): void {
    this.wallet.acceptComplianceCredential(credential);
  }

  createInvestmentProof(
    verifier: InvestmentVerifierContractStub,
  ): InvestmentProofBundle {
    return this.wallet.createInvestmentProof(verifier);
  }
}
