import { pureCircuits as complianceCircuits } from "@midnight-ntwrk/midnight-did-credentials-compliance";
import { pureCircuits as passportCircuits } from "@midnight-ntwrk/midnight-did-credentials-passport-secret";
import { pureCircuits as sameHolderCircuits } from "@midnight-ntwrk/midnight-did-credentials-same-holder";

import { sha256 } from "../crypto/secure-store.js";
import type {
  CryptoTransferReceipt,
  InvestmentDecision,
  InvestmentProduct,
  InvestmentProofBundle,
  WalletProfile,
} from "../types.js";
import type { CryptoWalletStub } from "./crypto-wallet.js";

export class InvestmentVerifierContractStub {
  constructor(
    public readonly treasuryAddress: string,
    private readonly product: InvestmentProduct,
  ) {}

  requirements(): InvestmentProduct {
    return this.product;
  }

  challengeFor(profile: WalletProfile): Uint8Array {
    return sha256(`investment:${this.product.id}:${profile.id}:challenge`);
  }

  verify(
    bundle: InvestmentProofBundle,
    profile: WalletProfile,
  ): InvestmentDecision {
    try {
      if (
        bundle.nationalId.presentation.disclosed.ageThresholdYears !==
        this.product.minimumAgeYears
      ) {
        return {
          approved: false,
          reason: "Age threshold does not match product requirements",
        };
      }
      if (
        bundle.compliance.presentation.disclosed.maxScreeningAgeDays !==
        this.product.maxScreeningAgeDays
      ) {
        return {
          approved: false,
          reason:
            "Screening freshness window does not match product requirements",
        };
      }

      passportCircuits.assertValidSecretPassportCredentialAgePredicate(
        bundle.nationalId.credential,
        bundle.nationalId.presentation,
        bundle.nationalId.witness.currentDay,
        bundle.nationalId.witness.birthDateDays,
        bundle.nationalId.witness.birthDateOpening,
      );
      passportCircuits.assertSecretPassportNotExpired(
        bundle.nationalId.credential,
        bundle.nationalId.witness.currentDay,
      );
      complianceCircuits.assertSanctionScreeningPresentationSatisfiesRequest(
        bundle.compliance.credential,
        bundle.compliance.credentialProof,
        bundle.compliance.presentationRequest,
        bundle.compliance.presentation,
        profile.holder.holderSecret,
        profile.holder.complianceOpening,
        profile.holder.complianceBlindingFactor,
      );
      complianceCircuits.assertSanctionScreeningResultPass(
        bundle.compliance.credential,
        bundle.compliance.presentation,
      );
      complianceCircuits.assertSanctionScreeningPepFalse(
        bundle.compliance.credential,
        bundle.compliance.presentation,
      );
      complianceCircuits.assertSanctionScreeningFresh(
        bundle.compliance.credential,
        bundle.compliance.presentation,
        bundle.compliance.witness.currentDay,
        bundle.compliance.witness.screeningDateDay,
        bundle.compliance.witness.screeningDateOpening,
      );
      complianceCircuits.assertSanctionScreeningNotExpired(
        bundle.compliance.credential,
        bundle.compliance.witness.currentDay,
      );
      sameHolderCircuits.assertSameBlindedSecretHolderBindingWitnesses(
        bundle.nationalId.presentation.holderBinding,
        bundle.compliance.presentation.holderBinding,
        bundle.verifierChallengeHash,
        profile.holder.holderSecret,
        profile.holder.passportOpening,
        profile.holder.passportBlindingFactor,
        profile.holder.complianceOpening,
        profile.holder.complianceBlindingFactor,
      );

      return {
        approved: true,
        participationCommitment: sha256(
          `participation:${this.product.id}:${profile.id}`,
        ),
        passportBinding: bundle.nationalId.presentation.holderBinding,
        complianceBinding: bundle.compliance.presentation.holderBinding,
      };
    } catch (error) {
      return {
        approved: false,
        reason:
          error instanceof Error ? error.message : "Unknown verifier error",
      };
    }
  }

  settle({
    decision,
    wallet,
  }: {
    readonly decision: InvestmentDecision;
    readonly wallet: CryptoWalletStub;
  }): CryptoTransferReceipt {
    if (!decision.approved) {
      throw new Error(`Cannot settle denied investment: ${decision.reason}`);
    }

    return wallet.transfer({
      to: this.treasuryAddress,
      amount: this.product.price,
    });
  }
}
