import {
  encodeSanctionScreeningCredential,
  encodeSanctionScreeningProof,
  type SanctionScreeningFixture,
} from "@midnight-ntwrk/midnight-did-credentials-compliance";
import {
  assertPresentationSubmissionMatchesDefinition,
  createCredentialIssuerMetadata,
  createCredentialRequest,
  createCredentialResponse,
  createPresentationDefinition,
  createVpAuthorizationRequest,
  createVpAuthorizationResponse,
  type CredentialIssuerMetadata,
  type CredentialOffer,
  type CredentialRequest,
  type CredentialResponse,
  type TokenRequest,
  type TokenResponse,
  type VpAuthorizationResponse,
} from "@midnight-ntwrk/midnight-did-credentials-openid";
import {
  decodeSecretPassportCredential,
  decodeSecretPassportPresentation,
  decodeSecretPassportPresentationRequest,
  decodeSecretPassportProof,
  pureCircuits as passportCircuits,
} from "@midnight-ntwrk/midnight-did-credentials-passport-secret";
import { URL } from "url";

import { ComplianceIssuerAgent } from "../actors/compliance-issuer.js";
import { sha256 } from "../crypto/secure-store.js";
import type {
  HolderSecretMaterial,
  NationalIdPresentationContext,
  NationalIdPresentationSubmission,
  NationalIdPresentationVpToken,
  ScreeningPresentationRequestState,
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
  nationalIdPresentation?: NationalIdPresentationContext;
  authorizationRequest: ScreeningPresentationRequestState;
  authorizationRequestConsumed: boolean;
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

const hexToBytes = (value: string): Uint8Array => {
  const normalized = value.startsWith("0x") ? value.slice(2) : value;
  if (normalized.length % 2 !== 0) {
    throw new Error("Hex byte string must have even length");
  }
  return Uint8Array.from(
    normalized.match(/../g)?.map((part) => Number.parseInt(part, 16)) ?? [],
  );
};

const randomRequestId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const createWalletRequestRedirect = (
  session: MutableScreeningIssuerSession,
): string => {
  const redirect = new URL(session.redirectUri);
  redirect.searchParams.set(
    "request_uri",
    session.authorizationRequest.requestUri,
  );
  redirect.searchParams.set(
    "client_id",
    session.authorizationRequest.request.client_id,
  );
  redirect.searchParams.set(
    "screening_request",
    session.authorizationRequest.id,
  );
  return redirect.toString();
};

const publicSession = (
  session: MutableScreeningIssuerSession,
): ScreeningIssuerSessionState => publicIssuerSession(session);

const nationalIdPresentationContext = (
  submission: NationalIdPresentationSubmission,
): NationalIdPresentationContext => {
  const { vpToken } = submission;
  const prototypeWitness = vpToken.prototypeWitness;
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
  const presentationRequest = decodeSecretPassportPresentationRequest(
    vpToken.presentationRequest,
  );
  const presentation = decodeSecretPassportPresentation(vpToken.presentation);
  passportCircuits.assertValidSecretPassportCredentialPresentationRequest(
    presentationRequest,
  );
  if (!bytesEqual(presentation.credentialClaimRoot, credential.claimRoot)) {
    throw new Error(
      "National ID presentation is not anchored to the credential",
    );
  }
  if (vpToken.holderBinding.method !== "blinded_secret_commitment") {
    throw new Error("National ID VP requires blinded holder binding");
  }
  if (
    vpToken.holderBinding.challenge !==
    bytesToHex(presentationRequest.verifierChallengeHash)
  ) {
    throw new Error("National ID VP holder-binding challenge mismatch");
  }
  if (
    vpToken.holderBinding.blindedCommitment !==
    bytesToHex(credential.holderBinding.blindedHolderSecretCommitment)
  ) {
    throw new Error("National ID VP holder-binding commitment mismatch");
  }
  passportCircuits.assertSecretPassportPresentationSatisfiesRequest(
    credential,
    credentialProof,
    presentationRequest,
    presentation,
    hexToBytes(prototypeWitness.holderSecret),
    hexToBytes(prototypeWitness.passportOpening),
    hexToBytes(prototypeWitness.passportBlindingFactor),
  );

  return {
    credential,
    credentialProof,
    presentationRequest,
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
    readonly walletOrigin: string;
  }): {
    readonly session: ScreeningIssuerSessionState;
    readonly redirectUrl: string;
  } {
    const issuerIdentity = this.issuerIdentity();
    const baseSession = createIssuerSession({
      idPrefix: "screening",
      redirectUri: input.walletOrigin,
      issuerOrigin: input.issuerOrigin,
      issuerDid: issuerIdentity.did,
      issuerMethodId: issuerIdentity.signer.verificationMethodRef.methodId,
      checks: {
        nationalIdPresentationVerified: false,
        sanctionsChecked: false,
        pepChecked: false,
        profileApproved: false,
      },
      status: "created",
    });
    const requestId = baseSession.id;
    const session: MutableScreeningIssuerSession = {
      ...baseSession,
      authorizationRequest: {
        id: requestId,
        requestUri: `${input.issuerOrigin}/api/issuer/screening/requests/${requestId}`,
        request: createVpAuthorizationRequest({
          response_type: "vp_token",
          client_id: issuerIdentity.did,
          redirect_uri: `${input.issuerOrigin}/api/issuer/screening/direct-post`,
          response_mode: "direct_post",
          state: randomRequestId("screening-state"),
          nonce: randomRequestId("screening-nonce"),
          presentation_definition: createPresentationDefinition({
            id: `screening-definition-${requestId}`,
            name: "National ID required for sanctions screening",
            purpose:
              "The Screening issuer requires a Midnight National ID presentation before compliance checks can begin.",
            input_descriptors: [
              {
                id: "national-id",
                name: "Digital National ID",
                constraints: {
                  fields: [{ path: ["$.presentationFamily"] }],
                },
              },
            ],
          }),
          midnight: {
            verifierDomain: "screening-issuer.prototype",
            challenge: toHex(sha256(`screening-vp:${requestId}`)),
            acceptedCredentialFamilies: ["passport-secret"],
            requireSameHolder: false,
            predicateHints: [
              "midnight:predicate:age-over",
              "midnight:predicate:not-expired",
            ],
          },
        }),
      },
      authorizationRequestConsumed: false,
    };
    this.sessions.set(session.id, session);

    return {
      session: publicSession(session),
      redirectUrl: createWalletRequestRedirect(session),
    };
  }

  getAuthorizationRequest(
    requestId: string,
  ): ScreeningPresentationRequestState {
    return this.requireSessionByRequestId(requestId).authorizationRequest;
  }

  acceptAuthorizationResponse(input: {
    readonly requestId: string;
    readonly response: VpAuthorizationResponse;
  }): {
    readonly session: ScreeningIssuerSessionState;
    readonly redirectUrl: string;
  } {
    const session = this.requireSessionByRequestId(input.requestId);
    if (session.authorizationRequestConsumed) {
      throw new Error("Screening presentation request has already been used");
    }
    if (session.status === "denied") {
      throw new Error(session.denialReason ?? "Screening issuer denied");
    }

    const response = createVpAuthorizationResponse(input.response);
    const request = session.authorizationRequest.request;
    if ((response.state ?? "") !== (request.state ?? "")) {
      throw new Error("Screening presentation response state mismatch");
    }
    assertPresentationSubmissionMatchesDefinition({
      definition: request.presentation_definition,
      submission: response.presentation_submission,
    });
    const vpToken =
      response.vp_token as unknown as NationalIdPresentationVpToken;
    const nationalIdPresentation = nationalIdPresentationContext({ vpToken });
    session.nationalIdPresentation = nationalIdPresentation;
    session.authorizationRequestConsumed = true;
    session.checks.nationalIdPresentationVerified = true;

    return {
      session: publicSession(session),
      redirectUrl: createIssuerRedirect({
        issuerOrigin: session.issuerOrigin,
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
    if (!session.nationalIdPresentation) {
      throw new Error(
        "National ID presentation must be submitted before issuance",
      );
    }
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

  private requireSessionByRequestId(
    requestId: string,
  ): MutableScreeningIssuerSession {
    for (const session of this.sessions.values()) {
      if (session.authorizationRequest.id === requestId) {
        return session;
      }
    }
    throw new Error(
      `Screening presentation request "${requestId}" was not found`,
    );
  }

  private findByAccessToken(
    accessToken: string,
  ): MutableScreeningIssuerSession {
    return findByAccessToken(this.sessions.values(), accessToken);
  }
}
