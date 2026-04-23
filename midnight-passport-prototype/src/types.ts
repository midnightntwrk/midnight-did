import type {
  BlindedSecretHolderBinding,
  Proof,
} from "@midnight-ntwrk/midnight-did-credentials";
import type { SanctionScreeningFixture } from "@midnight-ntwrk/midnight-did-credentials-compliance";
import type {
  EncodedCompactValue,
  MidnightHolderBinding,
} from "@midnight-ntwrk/midnight-did-credentials-openid";
import type {
  PassportCredentialFixture,
  SecretPassportCredential,
  SecretPassportCredentialPresentation,
  SecretPassportCredentialPresentationRequest,
} from "@midnight-ntwrk/midnight-did-credentials-passport-secret";

export type ComplianceCredentialFixture = SanctionScreeningFixture;

export type HolderSecretMaterial = {
  readonly holderSecret: Uint8Array;
  readonly passportOpening: Uint8Array;
  readonly passportBlindingFactor: Uint8Array;
  readonly complianceOpening: Uint8Array;
  readonly complianceBlindingFactor: Uint8Array;
};

export type WalletProfile = {
  readonly id: string;
  readonly did: string;
  readonly displayName: string;
  readonly holder: HolderSecretMaterial;
  readonly passkeyCredentialId?: string;
  readonly walletSeedHash?: string;
};

export type WalletCredentialInventory = {
  readonly nationalId?: PassportCredentialFixture;
  readonly compliance?: SanctionScreeningFixture;
};

export type NationalIdPresentationVpToken = {
  readonly format: "midnight_compact_vp";
  readonly presentationFamily: "passport-secret";
  readonly schemaId: "national-id-proxy:v1";
  readonly schemaVersion: "1.0";
  readonly credential: EncodedCompactValue;
  readonly credentialProof: EncodedCompactValue;
  readonly presentationRequest: EncodedCompactValue;
  readonly presentation: EncodedCompactValue;
  readonly holderBinding: MidnightHolderBinding;
};

export type NationalIdPresentationContext = {
  readonly credential: SecretPassportCredential;
  readonly credentialProof: Proof;
  readonly presentationRequest: SecretPassportCredentialPresentationRequest;
  readonly presentation: SecretPassportCredentialPresentation;
};

export type NationalIdPresentationSubmission = {
  readonly vpToken: NationalIdPresentationVpToken;
};

export type InvestmentProduct = {
  readonly id: string;
  readonly title: string;
  readonly minimumAgeYears: bigint;
  readonly maxScreeningAgeDays: bigint;
  readonly price: bigint;
};

export type InvestmentProofBundle = {
  readonly nationalId: PassportCredentialFixture;
  readonly compliance: SanctionScreeningFixture;
  readonly verifierChallengeHash: Uint8Array;
};

export type InvestmentDecision =
  | {
      readonly approved: true;
      readonly participationCommitment: Uint8Array;
      readonly passportBinding: BlindedSecretHolderBinding;
      readonly complianceBinding: BlindedSecretHolderBinding;
    }
  | {
      readonly approved: false;
      readonly reason: string;
    };

export type CryptoTransferReceipt = {
  readonly from: string;
  readonly to: string;
  readonly amount: bigint;
  readonly txId: string;
};
