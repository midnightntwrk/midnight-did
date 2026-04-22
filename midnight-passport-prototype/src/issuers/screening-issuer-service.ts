import {
  encodeSanctionScreeningCredential,
  encodeSanctionScreeningProof,
  type SanctionScreeningFixture,
} from "@midnight-ntwrk/midnight-did-credentials-compliance";
import {
  createCredentialIssuerMetadata,
  createCredentialRequest,
  createCredentialResponse,
  type CredentialIssuerMetadata,
  type CredentialOffer,
  type CredentialRequest,
  type CredentialResponse,
  type TokenRequest,
  type TokenResponse,
} from "@midnight-ntwrk/midnight-did-credentials-openid";
import {
  decodeSecretPassportCredential,
  decodeSecretPassportPresentation,
  decodeSecretPassportProof,
  type PassportCredentialFixture,
} from "@midnight-ntwrk/midnight-did-credentials-passport-secret";

import { ComplianceIssuerAgent } from "../actors/compliance-issuer.js";
import { sha256 } from "../crypto/secure-store.js";
import type {
  HolderSecretMaterial,
  NationalIdPresentationSubmission,
} from "../types.js";
import {
  allChecksPassed,
  createIssuerRedirect,
  createIssuerSession,
  createOfferCallback,
  createTokenRequestFromOffer,
  exchangePreAuthorizedToken,
  findByAccessToken,
  type IssuerSessionRecord,
  parseCredentialOffer,
  type PublicIssuerSession,
  publicIssuerSession,
  toHex,
} from "./issuer-session.js";

export const SCREENING_CREDENTIAL_CONFIGURATION_ID =
  "midnight_passport_screening_v1";

export type ScreeningIssuerCheck =
  | "nationalIdPresentationVerified"
  | "sanctionsChecked"
  | "pepChecked"
  | "profileApproved";

type ScreeningIssuerStatus =
  | "created"
  | "checks_completed"
  | "offer_issued"
  | "token_issued"
  | "credential_issued"
  | "denied";

export type ScreeningIssuerSessionState = PublicIssuerSession<
  ScreeningIssuerCheck,
  ScreeningIssuerStatus
>;

export type ScreeningIssuedCredential = {
  readonly response: CredentialResponse;
  readonly credential: SanctionScreeningFixture;
};

type MutableScreeningIssuerSession = IssuerSessionRecord<
  ScreeningIssuerCheck,
  ScreeningIssuerStatus
> & {
  nationalIdPresentation: PassportCredentialFixture;
};

const checks: readonly ScreeningIssuerCheck[] = [
  "nationalIdPresentationVerified",
  "sanctionsChecked",
  "pepChecked",
  "profileApproved",
];

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length &&
  left.every((byte, index) => byte === right[index]);

const bytesToHex = (value: Uint8Array): string =>
  [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const publicSession = (
  session: MutableScreeningIssuerSession,
): ScreeningIssuerSessionState => publicIssuerSession(session);

const nationalIdPresentationFixture = (
  submission: NationalIdPresentationSubmission,
): PassportCredentialFixture => {
  const { vpToken, prototypeFixture } = submission;
  if (vpToken.format !== "midnight_compact_vp") {
    throw new Error("Screening issuer requires a Midnight Compact VP token");
  }
  if (
    vpToken.presentationFamily !== "passport-secret" ||
    vpToken.schemaId !== "national-id-proxy:v1"
  ) {
    throw new Error("Screening issuer requires a National ID presentation");
  }

  const credential = decodeSecretPassportCredential(vpToken.credential);
  const credentialProof = decodeSecretPassportProof(vpToken.credentialProof);
  const presentation = decodeSecretPassportPresentation(vpToken.presentation);
  if (!bytesEqual(presentation.credentialClaimRoot, credential.claimRoot)) {
    throw new Error(
      "National ID presentation is not anchored to the credential",
    );
  }
  if (
    !bytesEqual(credential.claimRoot, prototypeFixture.credential.claimRoot) ||
    !bytesEqual(
      presentation.credentialClaimRoot,
      prototypeFixture.presentation.credentialClaimRoot,
    )
  ) {
    throw new Error("National ID VP token does not match prototype fixture");
  }
  if (vpToken.holderBinding.method !== "blinded_secret_commitment") {
    throw new Error("National ID VP requires blinded holder binding");
  }
  if (
    vpToken.holderBinding.challenge !==
    bytesToHex(prototypeFixture.presentationRequest.verifierChallengeHash)
  ) {
    throw new Error("National ID VP holder-binding challenge mismatch");
  }
  if (
    vpToken.holderBinding.blindedCommitment !==
    bytesToHex(credential.holderBinding.blindedHolderSecretCommitment)
  ) {
    throw new Error("National ID VP holder-binding commitment mismatch");
  }

  return {
    ...prototypeFixture,
    credential,
    credentialProof,
    presentation,
  };
};

export class ScreeningIssuerService {
  private readonly sessions = new Map<string, MutableScreeningIssuerSession>();
  private readonly issuer = new ComplianceIssuerAgent({
    sanctioned: false,
    pep: false,
  });

  issuerIdentity(): ReturnType<ComplianceIssuerAgent["identity"]> {
    return this.issuer.identity();
  }

  metadata(issuerOrigin: string): CredentialIssuerMetadata {
    return createCredentialIssuerMetadata({
      credential_issuer: issuerOrigin,
      credential_endpoint: `${issuerOrigin}/api/issuer/screening/credential`,
      token_endpoint: `${issuerOrigin}/api/issuer/screening/token`,
      credential_configurations_supported: {
        [SCREENING_CREDENTIAL_CONFIGURATION_ID]: {
          format: "midnight_compact_vc",
          scope: "sanction_screening",
          cryptographic_binding_methods_supported: [
            "blinded_secret_commitment",
          ],
          proof_types_supported: {
            jwt: {
              proof_signing_alg_values_supported: ["EdDSA", "ES256"],
            },
          },
          display: [{ name: "Sanctions Screening" }],
          credential_definition: {
            issuerDid: this.issuerIdentity().did,
            issuerKeyType: "jubjub",
            requiresCredentialFamily: "passport-secret",
          },
        },
      },
    });
  }

  start(input: {
    readonly issuerOrigin: string;
    readonly redirectUri: string;
    readonly nationalIdPresentation: NationalIdPresentationSubmission;
  }): {
    readonly session: ScreeningIssuerSessionState;
    readonly redirectUrl: string;
  } {
    const nationalIdPresentation = nationalIdPresentationFixture(
      input.nationalIdPresentation,
    );

    const issuerIdentity = this.issuerIdentity();
    const session: MutableScreeningIssuerSession = {
      ...createIssuerSession({
        idPrefix: "screening",
        redirectUri: input.redirectUri,
        issuerOrigin: input.issuerOrigin,
        issuerDid: issuerIdentity.did,
        issuerMethodId: issuerIdentity.signer.verificationMethodRef.methodId,
        checks: {
          nationalIdPresentationVerified: true,
          sanctionsChecked: false,
          pepChecked: false,
          profileApproved: false,
        },
        status: "created",
      }),
      nationalIdPresentation,
    };
    this.sessions.set(session.id, session);

    return {
      session: publicSession(session),
      redirectUrl: createIssuerRedirect({
        issuerOrigin: input.issuerOrigin,
        page: "screening-issuer.html",
        sessionId: session.id,
      }),
    };
  }

  getSession(id: string): ScreeningIssuerSessionState {
    return publicSession(this.requireSession(id));
  }

  setCheck(input: {
    readonly sessionId: string;
    readonly check: ScreeningIssuerCheck;
    readonly value: boolean;
  }): ScreeningIssuerSessionState {
    if (!checks.includes(input.check)) {
      throw new Error(`Unknown Screening issuer check "${input.check}"`);
    }
    const session = this.requireSession(input.sessionId);
    session.checks[input.check] = input.value;
    if (allChecksPassed(session, checks)) {
      session.status = "checks_completed";
    }
    return publicSession(session);
  }

  deny(input: {
    readonly sessionId: string;
    readonly reason: "sanctions_match" | "pep_match";
  }): ScreeningIssuerSessionState {
    const session = this.requireSession(input.sessionId);
    session.status = "denied";
    session.denialReason =
      input.reason === "sanctions_match"
        ? "Sanctions screening returned a possible match"
        : "PEP screening returned a possible match";
    return publicSession(session);
  }

  completeChecks(sessionId: string): {
    readonly session: ScreeningIssuerSessionState;
    readonly redirectUrl: string;
  } {
    const session = this.requireSession(sessionId);
    if (session.status === "denied") {
      throw new Error(session.denialReason ?? "Screening issuer denied");
    }
    if (!allChecksPassed(session, checks)) {
      throw new Error("All Screening issuer checks must pass first");
    }

    const redirectUrl = createOfferCallback(session, {
      credentialConfigurationId: SCREENING_CREDENTIAL_CONFIGURATION_ID,
      issuerKind: "screening",
    });

    return {
      session: publicSession(session),
      redirectUrl,
    };
  }

  createTokenRequest(credentialOfferUriValue: string): TokenRequest {
    return createTokenRequestFromOffer(credentialOfferUriValue);
  }

  exchangeToken(request: TokenRequest): TokenResponse {
    return exchangePreAuthorizedToken({
      sessions: this.sessions.values(),
      request,
      nonceLabel: "screening-c-nonce",
    });
  }

  createCredentialRequest(input: {
    readonly holder: HolderSecretMaterial;
    readonly token: TokenResponse;
  }): CredentialRequest {
    return createCredentialRequest({
      credential_configuration_id: SCREENING_CREDENTIAL_CONFIGURATION_ID,
      format: "midnight_compact_vc",
      proof: {
        proof_type: "jwt",
        jwt: `prototype-ed25519-pop.${input.token.c_nonce ?? "nonce"}`,
      },
      midnight: {
        holderBinding: {
          method: "blinded_secret_commitment",
          challenge: input.token.c_nonce ?? toHex(sha256("screening-c-nonce")),
          blindedCommitment: toHex(input.holder.complianceBlindingFactor),
          verifierDomain: "screening-issuer.prototype",
        },
        requestedClaims: [
          "screeningResultPass",
          "pepFalse",
          "screeningFresh",
          "notExpired",
        ],
      },
    });
  }

  issueCredential(input: {
    readonly accessToken: string;
    readonly request: CredentialRequest;
    readonly holder: HolderSecretMaterial;
  }): ScreeningIssuedCredential {
    const session = this.findByAccessToken(input.accessToken);
    if (
      input.request.credential_configuration_id !==
      SCREENING_CREDENTIAL_CONFIGURATION_ID
    ) {
      throw new Error("Unsupported credential configuration");
    }
    if (
      input.request.midnight?.holderBinding.method !==
      "blinded_secret_commitment"
    ) {
      throw new Error("Screening issuance requires blinded holder binding");
    }

    const result = this.issuer.screenAndIssue({
      nationalIdPresentation: session.nationalIdPresentation,
      holder: input.holder,
    });
    if (!result.issued) {
      throw new Error(result.reason);
    }

    session.status = "credential_issued";
    const response = createCredentialResponse({
      credential: {
        format: "midnight_compact_vc",
        credentialFamily: "sanction-screening",
        schemaId: "sanction-screening:v1",
        schemaVersion: "1.0",
        credential: encodeSanctionScreeningCredential(
          result.credential.credential,
        ),
        credentialProof: encodeSanctionScreeningProof(
          result.credential.credentialProof,
        ),
        holderBinding: input.request.midnight.holderBinding,
      },
      c_nonce: toHex(sha256(`screening-next-c-nonce:${session.id}`)),
      c_nonce_expires_in: 300,
    });

    return { response, credential: result.credential };
  }

  redeemOffer(input: {
    readonly credentialOfferUri: string;
    readonly holder: HolderSecretMaterial;
  }): ScreeningIssuedCredential {
    const tokenRequest = this.createTokenRequest(input.credentialOfferUri);
    const token = this.exchangeToken(tokenRequest);
    const credentialRequest = this.createCredentialRequest({
      holder: input.holder,
      token,
    });
    return this.issueCredential({
      accessToken: token.access_token,
      request: credentialRequest,
      holder: input.holder,
    });
  }

  offerFromUri(credentialOfferUriValue: string): CredentialOffer {
    return parseCredentialOffer(credentialOfferUriValue);
  }

  private requireSession(id: string): MutableScreeningIssuerSession {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Screening issuer session "${id}" was not found`);
    }
    return session;
  }

  private findByAccessToken(
    accessToken: string,
  ): MutableScreeningIssuerSession {
    return findByAccessToken(this.sessions.values(), accessToken);
  }
}
