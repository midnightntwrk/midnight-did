import type { Proof } from "@midnight-ntwrk/midnight-did-credentials";
import {
  createSanctionScreeningFixture,
  createSigner,
  type Signer,
} from "@midnight-ntwrk/midnight-did-credentials-compliance";
import type {
  SecretPassportCredential,
  SecretPassportCredentialPresentation,
  SecretPassportCredentialPresentationRequest,
} from "@midnight-ntwrk/midnight-did-credentials-passport-secret";

import type {
  HolderSecretMaterial,
  NationalIdPresentationContext,
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
    nationalIdPresentation: _nationalIdPresentation,
    holder,
    verifierChallengeHash,
  }: {
    readonly nationalIdPresentation:
      | NationalIdPresentationContext
      | {
          readonly credential: SecretPassportCredential;
          readonly credentialProof: Proof;
          readonly presentationRequest: SecretPassportCredentialPresentationRequest;
          readonly presentation: SecretPassportCredentialPresentation;
        };
    readonly holder: HolderSecretMaterial;
    readonly verifierChallengeHash?: Uint8Array;
  }): ComplianceCredentialResult {
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
