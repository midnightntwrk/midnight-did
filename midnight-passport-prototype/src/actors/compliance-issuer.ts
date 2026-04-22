import { createSanctionScreeningFixture } from "@midnight-ntwrk/midnight-did-credentials-compliance";
import { pureCircuits as passportCircuits } from "@midnight-ntwrk/midnight-did-credentials-passport-secret";

import type {
  HolderSecretMaterial,
  WalletCredentialInventory,
} from "../types.js";

export type ComplianceScreeningPolicy = {
  readonly sanctioned: boolean;
  readonly pep: boolean;
};

export type ComplianceCredentialResult =
  | {
      readonly issued: true;
      readonly credential: ReturnType<typeof createSanctionScreeningFixture>;
    }
  | {
      readonly issued: false;
      readonly reason: string;
    };

export class ComplianceIssuerAgent {
  constructor(private readonly policy: ComplianceScreeningPolicy) {}

  screenAndIssue({
    inventory,
    holder,
    verifierChallengeHash,
  }: {
    readonly inventory: WalletCredentialInventory;
    readonly holder: HolderSecretMaterial;
    readonly verifierChallengeHash?: Uint8Array;
  }): ComplianceCredentialResult {
    if (!inventory.nationalId) {
      return { issued: false, reason: "National ID credential is required" };
    }

    passportCircuits.assertSecretPassportPresentationSatisfiesRequest(
      inventory.nationalId.credential,
      inventory.nationalId.credentialProof,
      inventory.nationalId.presentationRequest,
      inventory.nationalId.presentation,
      holder.holderSecret,
      holder.passportOpening,
      holder.passportBlindingFactor,
    );

    if (this.policy.sanctioned) {
      return { issued: false, reason: "Sanctions screening failed" };
    }
    if (this.policy.pep) {
      return { issued: false, reason: "PEP screening failed" };
    }

    return {
      issued: true,
      credential: createSanctionScreeningFixture({
        holderSecret: holder.holderSecret,
        holderSecretOpening: holder.complianceOpening,
        holderBindingBlindingFactor: holder.complianceBlindingFactor,
        verifierChallengeHash,
      }),
    };
  }
}
