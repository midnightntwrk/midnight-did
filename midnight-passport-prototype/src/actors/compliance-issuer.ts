import {
  createSanctionScreeningFixture,
  createSigner,
  type Signer,
} from "@midnight-ntwrk/midnight-did-credentials-compliance";
import { pureCircuits as passportCircuits } from "@midnight-ntwrk/midnight-did-credentials-passport-secret";

import type {
  HolderSecretMaterial,
  WalletCredentialInventory,
} from "../types.js";

export type ComplianceScreeningPolicy = {
  readonly sanctioned: boolean;
  readonly pep: boolean;
};

export type ComplianceIssuerIdentity = {
  readonly did: string;
  readonly signer: Signer;
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
  private readonly issuerIdentity: ComplianceIssuerIdentity;

  constructor(
    private readonly policy: ComplianceScreeningPolicy,
    identity?: Partial<ComplianceIssuerIdentity>,
  ) {
    this.issuerIdentity = {
      did: identity?.did ?? "did:midnight:prototype:screening-issuer",
      signer:
        identity?.signer ??
        createSigner("screening-issuer", 98_765_432n, "#screening-jubjub-1"),
    };
  }

  identity(): ComplianceIssuerIdentity {
    return this.issuerIdentity;
  }

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
        issuerLabel: this.issuerIdentity.signer.label,
        issuerSecretKey: this.issuerIdentity.signer.secretKey,
        issuerVerificationMethodRef:
          this.issuerIdentity.signer.verificationMethodRef,
        holderSecret: holder.holderSecret,
        holderSecretOpening: holder.complianceOpening,
        holderBindingBlindingFactor: holder.complianceBlindingFactor,
        verifierChallengeHash,
      }),
    };
  }
}
