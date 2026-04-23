import { Buffer } from "node:buffer";
import { randomBytes } from "node:crypto";

import { pureCircuits as genericCircuits } from "@midnight-ntwrk/midnight-did-credentials";
import {
  encodeSecretPassportCredential,
  encodeSecretPassportPresentation,
  encodeSecretPassportPresentationRequest,
  encodeSecretPassportProof,
  type PassportCredentialFixture,
} from "@midnight-ntwrk/midnight-did-credentials-passport-secret";

import {
  decryptAesGcm,
  deriveStoreKey,
  encryptAesGcm,
  type EncryptedEnvelope,
  sha256,
} from "../crypto/secure-store.js";
import type {
  ComplianceCredentialFixture,
  HolderSecretMaterial,
  InvestmentProofBundle,
  NationalIdPresentationSubmission,
  WalletCredentialInventory,
  WalletProfile,
} from "../types.js";
import type { ComplianceIssuerAgent } from "./compliance-issuer.js";
import type { InvestmentVerifierContractStub } from "./investment-verifier.js";
import type { NationalIdIssuerAgent } from "./national-id-issuer.js";

export type WalletStores = {
  readonly secretStore: EncryptedEnvelope;
  readonly vcStore: EncryptedEnvelope;
};

export type WalletInitializationOptions = {
  readonly passkeyCredentialId: string;
  readonly walletSeed?: Uint8Array;
};

const toHex = (value: Uint8Array): string =>
  [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const seedMaterial = (walletSeed: Uint8Array, label: string): Uint8Array =>
  sha256(`${label}:${toHex(walletSeed)}`);

const holderMaterialFromSeed = (
  walletSeed: Uint8Array,
): HolderSecretMaterial => ({
  holderSecret: seedMaterial(walletSeed, "holder-secret"),
  passportOpening: seedMaterial(walletSeed, "holder-opening:passport"),
  passportBlindingFactor: seedMaterial(walletSeed, "holder-blinding:passport"),
  complianceOpening: seedMaterial(walletSeed, "holder-opening:compliance"),
  complianceBlindingFactor: seedMaterial(
    walletSeed,
    "holder-blinding:compliance",
  ),
});

const initialHolderMaterial = (profileId: string): HolderSecretMaterial => ({
  holderSecret: sha256(`holder-secret:${profileId}:pending-seed`),
  passportOpening: sha256(`holder-opening:${profileId}:passport:pending-seed`),
  passportBlindingFactor: sha256(
    `holder-blinding:${profileId}:passport:pending-seed`,
  ),
  complianceOpening: sha256(
    `holder-opening:${profileId}:compliance:pending-seed`,
  ),
  complianceBlindingFactor: sha256(
    `holder-blinding:${profileId}:compliance:pending-seed`,
  ),
});

export class MidnightPassportWallet {
  private inventory: WalletCredentialInventory = {};
  private stores?: WalletStores;
  private profileState: WalletProfile;
  private unlocked = false;

  constructor(profileId = "alice") {
    this.profileState = {
      id: profileId,
      did: `did:midnight:prototype:${profileId}`,
      displayName: "Alice Example",
      holder: initialHolderMaterial(profileId),
    };
  }

  get profile(): WalletProfile {
    return this.profileState;
  }

  initialize(
    passkeyPrfOutput: Uint8Array,
    options: WalletInitializationOptions,
  ): WalletStores {
    const walletSeed = options.walletSeed ?? new Uint8Array(randomBytes(32));
    const walletSeedHash = toHex(sha256(`wallet-seed:${toHex(walletSeed)}`));
    this.profileState = {
      ...this.profileState,
      holder: holderMaterialFromSeed(walletSeed),
      passkeyCredentialId: options.passkeyCredentialId,
      walletSeedHash,
    };

    const secretStoreKey = deriveStoreKey(
      passkeyPrfOutput,
      "midnight-passport-secret-store-v1",
    );
    const vcStoreKey = deriveStoreKey(
      passkeyPrfOutput,
      "midnight-passport-vc-store-v1",
    );

    this.stores = {
      secretStore: encryptAesGcm({
        key: secretStoreKey,
        iv: randomBytes(12),
        plaintext: Buffer.from(
          JSON.stringify({
            walletSeed: toHex(walletSeed),
            holderSecret: toHex(this.profile.holder.holderSecret),
          }),
        ),
      }),
      vcStore: encryptAesGcm({
        key: vcStoreKey,
        iv: randomBytes(12),
        plaintext: Buffer.from("credential-wallet:empty"),
      }),
    };
    this.unlocked = true;

    return this.stores;
  }

  lock(): void {
    this.unlocked = false;
  }

  unlock(passkeyPrfOutput: Uint8Array): void {
    this.assertStoresReadable(passkeyPrfOutput);
    this.unlocked = true;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  assertStoresReadable(passkeyPrfOutput: Uint8Array): void {
    if (!this.stores) {
      throw new Error("Wallet stores are not initialized");
    }

    decryptAesGcm({
      key: deriveStoreKey(
        passkeyPrfOutput,
        "midnight-passport-secret-store-v1",
      ),
      envelope: this.stores.secretStore,
    });
    decryptAesGcm({
      key: deriveStoreKey(passkeyPrfOutput, "midnight-passport-vc-store-v1"),
      envelope: this.stores.vcStore,
    });
  }

  credentialInventory(): WalletCredentialInventory {
    return { ...this.inventory };
  }

  requestNationalIdCredential(issuer: NationalIdIssuerAgent): void {
    this.assertUnlocked();
    this.inventory = {
      ...this.inventory,
      nationalId: issuer.issueCredential(this.profile.holder),
    };
  }

  acceptNationalIdCredential(credential: PassportCredentialFixture): void {
    this.assertUnlocked();
    this.inventory = {
      ...this.inventory,
      nationalId: credential,
    };
  }

  acceptComplianceCredential(credential: ComplianceCredentialFixture): void {
    this.assertUnlocked();
    this.inventory = {
      ...this.inventory,
      compliance: credential,
    };
  }

  requestComplianceCredential(issuer: ComplianceIssuerAgent): void {
    this.assertUnlocked();
    if (!this.inventory.nationalId) {
      throw new Error("National ID credential is missing");
    }
    const result = issuer.screenAndIssue({
      nationalIdPresentation: this.inventory.nationalId,
      holder: this.profile.holder,
    });
    if (!result.issued) {
      throw new Error(result.reason);
    }

    this.inventory = {
      ...this.inventory,
      compliance: result.credential,
    };
  }

  createNationalIdPresentationForScreening(
    verifierChallengeHash = sha256("challenge:screening-issuer"),
  ): NationalIdPresentationSubmission {
    this.assertUnlocked();
    if (!this.inventory.nationalId) {
      throw new Error("National ID credential is missing");
    }

    const presentationRequest = {
      ...this.inventory.nationalId.presentationRequest,
      verifierChallengeHash,
    };
    const presentation = {
      ...this.inventory.nationalId.presentation,
      holderBinding: {
        blindedHolderSecretCommitment:
          this.inventory.nationalId.credential.holderBinding
            .blindedHolderSecretCommitment,
        issuerNonce:
          this.inventory.nationalId.credential.holderBinding.issuerNonce,
        requestChallengeResponse:
          genericCircuits.secretHolderBindingChallengeResponse(
            this.profile.holder.holderSecret,
            verifierChallengeHash,
          ),
      },
    };
    return {
      vpToken: {
        format: "midnight_compact_vp",
        presentationFamily: "passport-secret",
        schemaId: "national-id-proxy:v1",
        schemaVersion: "1.0",
        credential: encodeSecretPassportCredential(
          this.inventory.nationalId.credential,
        ),
        credentialProof: encodeSecretPassportProof(
          this.inventory.nationalId.credentialProof,
        ),
        presentationRequest:
          encodeSecretPassportPresentationRequest(presentationRequest),
        presentation: encodeSecretPassportPresentation(presentation),
        holderBinding: {
          method: "blinded_secret_commitment",
          challenge: toHex(verifierChallengeHash),
          blindedCommitment: toHex(
            this.inventory.nationalId.credential.holderBinding
              .blindedHolderSecretCommitment,
          ),
          verifierDomain: "screening-issuer.prototype",
        },
      },
    };
  }

  createInvestmentProof(
    verifier: InvestmentVerifierContractStub,
  ): InvestmentProofBundle {
    this.assertUnlocked();
    if (!this.inventory.nationalId) {
      throw new Error("National ID credential is missing");
    }
    if (!this.inventory.compliance) {
      throw new Error("Compliance credential is missing");
    }

    const verifierChallengeHash = verifier.challengeFor(this.profile);
    const requirements = verifier.requirements();
    const nationalIdRequest = {
      ...this.inventory.nationalId.presentationRequest,
      requestedAgeThresholdYears: requirements.minimumAgeYears,
      requireNotExpired: true,
      verifierChallengeHash,
    };
    const nationalIdPresentation = {
      ...this.inventory.nationalId.presentation,
      holderBinding: {
        blindedHolderSecretCommitment:
          this.inventory.nationalId.credential.holderBinding
            .blindedHolderSecretCommitment,
        issuerNonce:
          this.inventory.nationalId.credential.holderBinding.issuerNonce,
        requestChallengeResponse:
          genericCircuits.secretHolderBindingChallengeResponse(
            this.profile.holder.holderSecret,
            verifierChallengeHash,
          ),
      },
      disclosed: {
        ...this.inventory.nationalId.presentation.disclosed,
        revealVerifierScopedPseudonym: true,
        verifierScopedPseudonym: genericCircuits.verifierScopedPseudonym(
          this.profile.holder.holderSecret,
          nationalIdRequest.verifierDomainHash,
        ),
        proveAgeOverThreshold: true,
        ageThresholdYears: requirements.minimumAgeYears,
        proveNotExpired: true,
      },
    };
    const complianceRequest = {
      ...this.inventory.compliance.presentationRequest,
      maxScreeningAgeDays: requirements.maxScreeningAgeDays,
      verifierChallengeHash,
    };
    const compliancePresentation = {
      ...this.inventory.compliance.presentation,
      holderBinding: {
        blindedHolderSecretCommitment:
          this.inventory.compliance.credential.holderBinding
            .blindedHolderSecretCommitment,
        issuerNonce:
          this.inventory.compliance.credential.holderBinding.issuerNonce,
        requestChallengeResponse:
          genericCircuits.secretHolderBindingChallengeResponse(
            this.profile.holder.holderSecret,
            verifierChallengeHash,
          ),
      },
      disclosed: {
        ...this.inventory.compliance.presentation.disclosed,
        revealVerifierScopedPseudonym: true,
        verifierScopedPseudonym: genericCircuits.verifierScopedPseudonym(
          this.profile.holder.holderSecret,
          complianceRequest.verifierDomainHash,
        ),
        proveScreeningFresh: true,
        maxScreeningAgeDays: requirements.maxScreeningAgeDays,
        proveNotExpired: true,
      },
    };

    return {
      verifierChallengeHash,
      nationalId: {
        ...this.inventory.nationalId,
        presentationRequest: nationalIdRequest,
        presentation: nationalIdPresentation,
      },
      compliance: {
        ...this.inventory.compliance,
        presentationRequest: complianceRequest,
        presentation: compliancePresentation,
      },
    };
  }

  private assertUnlocked(): void {
    if (!this.unlocked) {
      throw new Error("Wallet session is locked");
    }
  }
}
