import { Buffer } from "node:buffer";
import {
  createCipheriv,
  createDecipheriv,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  sign,
  verify,
} from "node:crypto";

import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";

import { pureCircuits as genericPureCircuits } from "../../../../credentials/src/managed/credentials/contract/index.js";
import { pureCircuits as secretPassportPureCircuits } from "../../../../credentials-passport-secret/src/managed/secret-passport-credential/contract/index.js";
import { createSecretPassportCredentialFixture } from "../../../../credentials-passport-secret/src/test/credential-fixtures.js";
import { pureCircuits as sameHolderPureCircuits } from "../../../../credentials-same-holder/src/managed/same-holder/contract/index.js";
import { createDIDProfile, sha256 } from "../helpers/did-provider.js";

setNetworkId("undeployed");

const aesGcmEncrypt = (key: Uint8Array, plaintext: Uint8Array): Uint8Array => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
};

const aesGcmDecrypt = (key: Uint8Array, envelope: Uint8Array): Uint8Array => {
  const iv = envelope.subarray(0, 12);
  const authTag = envelope.subarray(12, 28);
  const ciphertext = envelope.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};

const deriveStoreKey = (
  prfOutput: Uint8Array,
  info: string,
): Uint8Array =>
  new Uint8Array(
    hkdfSync("sha256", prfOutput, Buffer.alloc(0), Buffer.from(info), 32),
  );

describe("Lace Wallet + Midnight Passport DApp use-case prototypes", () => {
  it("UC-1 separates Midnight DID/JubJub identity from Ed25519 off-chain proof keys", () => {
    const holderProfile = createDIDProfile("holder", "alice", 987654321n);
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const proofPayload = Buffer.from("oid4vci:c_nonce:example");
    const detachedSignature = sign(null, proofPayload, privateKey);

    expect(holderProfile.signer.verificationMethodRef.methodId).toHaveLength(32);
    expect(holderProfile.signer.publicKey).toBeDefined();
    expect(verify(null, proofPayload, publicKey, detachedSignature)).toBe(true);
  });

  it("UC-2 protects the secret store and VC store with separate passkey-derived KEKs", () => {
    // Test-only stand-in for a WebAuthn PRF output or PIN-derived fallback.
    const prfOutput = sha256("webauthn-prf-output:alice-device");
    const secretStoreKey = deriveStoreKey(prfOutput, "lace-secret-store-v1");
    const vcStoreKey = deriveStoreKey(prfOutput, "lace-vc-store-v1");
    const secretStorePayload = Buffer.from("ed25519+jubjub private key refs");
    const vcStorePayload = Buffer.from("encrypted midnight credential wallet");

    const encryptedSecretStore = aesGcmEncrypt(
      secretStoreKey,
      secretStorePayload,
    );
    const encryptedVcStore = aesGcmEncrypt(vcStoreKey, vcStorePayload);

    expect(secretStoreKey).not.toEqual(vcStoreKey);
    expect(aesGcmDecrypt(secretStoreKey, encryptedSecretStore)).toEqual(
      secretStorePayload,
    );
    expect(aesGcmDecrypt(vcStoreKey, encryptedVcStore)).toEqual(vcStorePayload);
    expect(() => aesGcmDecrypt(secretStoreKey, encryptedVcStore)).toThrow();
  });

  it("UC-3a prototypes anonymous National ID issuance with secret passport credentials", () => {
    const fixture = createSecretPassportCredentialFixture({
      holderSecret: sha256("holder-secret:lace-wallet"),
      holderSecretOpening: sha256("holder-opening:lace-wallet"),
      holderBindingBlindingFactor: sha256("holder-blinding:issuer-session"),
    });

    expect(() =>
      secretPassportPureCircuits.assertValidSecretPassportCredential(
        fixture.credential,
        fixture.credentialProof,
      ),
    ).not.toThrow();
    expect(() =>
      secretPassportPureCircuits.assertValidSecretPassportCredentialPresentation(
        fixture.credential,
        fixture.credentialProof,
        fixture.presentation,
      ),
    ).not.toThrow();
    expect(fixture.credential.holderBinding).not.toHaveProperty(
      "holderVerificationMethodRef",
    );
  });

  it("UC-3b prototypes screening input with selective disclosure and pairwise pseudonyms", () => {
    const screenerDomain = sha256("domain:sanctions-screener.example");
    const otherDomain = sha256("domain:another-verifier.example");
    const fixture = createSecretPassportCredentialFixture({
      verifierDomainHash: screenerDomain,
      holderSecret: sha256("holder-secret:screening-flow"),
    });

    expect(() =>
      secretPassportPureCircuits.assertSecretPassportPresentationSatisfiesRequest(
        fixture.credential,
        fixture.credentialProof,
        fixture.presentationRequest,
        fixture.presentation,
        fixture.witness.holderSecret,
        fixture.witness.holderSecretOpening,
        fixture.witness.holderBindingBlindingFactor,
      ),
    ).not.toThrow();

    const screenerPseudonym =
      genericPureCircuits.verifierScopedPseudonym(
        fixture.witness.holderSecret,
        screenerDomain,
      );
    const repeatScreenerPseudonym =
      genericPureCircuits.verifierScopedPseudonym(
        fixture.witness.holderSecret,
        screenerDomain,
      );
    const otherPseudonym = genericPureCircuits.verifierScopedPseudonym(
      fixture.witness.holderSecret,
      otherDomain,
    );

    expect(fixture.presentation.disclosed.revealNationality).toBe(true);
    expect(fixture.presentation.disclosed.revealGender).toBe(false);
    expect(screenerPseudonym).toEqual(repeatScreenerPseudonym);
    expect(screenerPseudonym).not.toEqual(otherPseudonym);
  });

  it("UC-4c prototypes investment proof composition with age, expiry, sanctions PASS, and same-holder binding", () => {
    const verifierChallengeHash = sha256("investment-contract:challenge");
    const fixture = createSecretPassportCredentialFixture({
      verifierChallengeHash,
      holderSecret: sha256("holder-secret:investment-flow"),
      holderSecretOpening: sha256("holder-opening:passport"),
      holderBindingBlindingFactor: sha256("holder-blinding:passport"),
    });
    const screeningOpening = sha256("holder-opening:screening");
    const screeningBlindingFactor = sha256("holder-blinding:screening");
    const screeningIssuerNonce = sha256("issuer-nonce:screening");
    const screeningHolderCommitment =
      genericPureCircuits.secretHolderBindingCommitment(
        fixture.witness.holderSecret,
        screeningOpening,
      );
    const screeningBinding = {
      blindedHolderSecretCommitment:
        genericPureCircuits.blindedSecretHolderCommitment(
          screeningHolderCommitment,
          screeningIssuerNonce,
          screeningBlindingFactor,
        ),
      issuerNonce: screeningIssuerNonce,
      requestChallengeResponse:
        genericPureCircuits.secretHolderBindingChallengeResponse(
          fixture.witness.holderSecret,
          verifierChallengeHash,
        ),
    };
    const sanctionsScreening = {
      result: "PASS" as const,
      isPep: false,
      checkedLists: ["OFAC", "EU", "UN"] as const,
      holderBinding: screeningBinding,
    };

    expect(() =>
      secretPassportPureCircuits.assertValidSecretPassportCredentialAgePredicate(
        fixture.credential,
        fixture.presentation,
        fixture.witness.currentDay,
        fixture.witness.birthDateDays,
        fixture.witness.birthDateOpening,
      ),
    ).not.toThrow();
    expect(() =>
      secretPassportPureCircuits.assertSecretPassportNotExpired(
        fixture.credential,
        fixture.witness.currentDay,
      ),
    ).not.toThrow();
    expect(sanctionsScreening.result).toBe("PASS");
    expect(sanctionsScreening.isPep).toBe(false);
    expect(sanctionsScreening.checkedLists).toContain("OFAC");
    expect(() =>
      sameHolderPureCircuits.assertSameBlindedSecretHolderBindingWitnesses(
        fixture.presentation.holderBinding,
        sanctionsScreening.holderBinding,
        verifierChallengeHash,
        fixture.witness.holderSecret,
        fixture.witness.holderSecretOpening,
        fixture.witness.holderBindingBlindingFactor,
        screeningOpening,
        screeningBlindingFactor,
      ),
    ).not.toThrow();
  });
});
