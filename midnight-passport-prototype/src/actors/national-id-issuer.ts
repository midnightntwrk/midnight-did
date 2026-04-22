import {
  createSecretPassportCredentialFixture,
  createSigner,
  type Signer,
} from "@midnight-ntwrk/midnight-did-credentials-passport-secret";

import type { HolderSecretMaterial } from "../types.js";

export type NationalIdIssuerOptions = {
  readonly verifierChallengeHash?: Uint8Array;
};

export type NationalIdIssuerIdentity = {
  readonly did: string;
  readonly signer: Signer;
};

export class NationalIdIssuerAgent {
  private readonly issuerIdentity: NationalIdIssuerIdentity;

  constructor(identity?: Partial<NationalIdIssuerIdentity>) {
    this.issuerIdentity = {
      did: identity?.did ?? "did:midnight:prototype:national-id-issuer",
      signer:
        identity?.signer ??
        createSigner("national-id-issuer", 123456789n, "#nid-jubjub-1"),
    };
  }

  identity(): NationalIdIssuerIdentity {
    return this.issuerIdentity;
  }

  issueCredential(
    holder: HolderSecretMaterial,
    options: NationalIdIssuerOptions = {},
  ) {
    return createSecretPassportCredentialFixture({
      issuerLabel: this.issuerIdentity.signer.label,
      issuerSecretKey: this.issuerIdentity.signer.secretKey,
      issuerVerificationMethodRef:
        this.issuerIdentity.signer.verificationMethodRef,
      holderSecret: holder.holderSecret,
      holderSecretOpening: holder.passportOpening,
      holderBindingBlindingFactor: holder.passportBlindingFactor,
      verifierChallengeHash: options.verifierChallengeHash,
    });
  }
}
