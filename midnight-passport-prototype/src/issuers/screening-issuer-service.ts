import { URL } from "node:url";

import {
  encodeSanctionScreeningCredential,
  encodeSanctionScreeningProof,
  type SanctionScreeningFixture,
} from "@midnight-ntwrk/midnight-did-credentials-compliance";
import {
  createCredentialIssuerMetadata,
  createCredentialRequest,
  createCredentialResponse,
  createPreAuthorizedCredentialOffer,
  createPreAuthorizedTokenRequest,
  type CredentialIssuerMetadata,
  type CredentialOffer,
  credentialOfferUri,
  type CredentialRequest,
  type CredentialResponse,
  parseCredentialOfferUri,
  type TokenRequest,
  type TokenResponse,
} from "@midnight-ntwrk/midnight-did-credentials-openid";

import { ComplianceIssuerAgent } from "../actors/compliance-issuer.js";
import { sha256 } from "../crypto/secure-store.js";
import type {
  HolderSecretMaterial,
  WalletCredentialInventory,
} from "../types.js";

export const SCREENING_CREDENTIAL_CONFIGURATION_ID =
  "midnight_passport_screening_v1";

export type ScreeningIssuerCheck =
  | "nationalIdPresentationVerified"
  | "sanctionsChecked"
  | "pepChecked"
  | "profileApproved";

export type ScreeningIssuerSessionState = {
  readonly id: string;
  readonly state: string;
  readonly redirectUri: string;
  readonly issuerOrigin: string;
  readonly issuerDid: string;
  readonly issuerMethodId: string;
  readonly checks: Record<ScreeningIssuerCheck, boolean>;
  readonly status:
    | "created"
    | "checks_completed"
    | "offer_issued"
    | "token_issued"
    | "credential_issued";
  readonly credentialOfferUri?: string;
};

export type ScreeningIssuedCredential = {
  readonly response: CredentialResponse;
  readonly credential: SanctionScreeningFixture;
};

type MutableScreeningIssuerSession = {
  id: string;
  state: string;
  redirectUri: string;
  issuerOrigin: string;
  issuerDid: string;
  issuerMethodId: string;
  checks: Record<ScreeningIssuerCheck, boolean>;
  status: ScreeningIssuerSessionState["status"];
  preAuthorizedCode?: string;
  accessToken?: string;
  credentialOfferUri?: string;
  tokenConsumed: boolean;
};

const checks: readonly ScreeningIssuerCheck[] = [
  "nationalIdPresentationVerified",
  "sanctionsChecked",
  "pepChecked",
  "profileApproved",
];

const toHex = (value: Uint8Array): string =>
  `0x${[...value].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;

const randomId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const publicSession = (
  session: MutableScreeningIssuerSession,
): ScreeningIssuerSessionState => ({
  id: session.id,
  state: session.state,
  redirectUri: session.redirectUri,
  issuerOrigin: session.issuerOrigin,
  issuerDid: session.issuerDid,
  issuerMethodId: session.issuerMethodId,
  checks: { ...session.checks },
  status: session.status,
  credentialOfferUri: session.credentialOfferUri,
});

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
    readonly inventory: WalletCredentialInventory;
  }): {
    readonly session: ScreeningIssuerSessionState;
    readonly redirectUrl: string;
  } {
    if (!input.inventory.nationalId) {
      throw new Error("Digital National ID credential is required first");
    }

    const id = randomId("screening");
    const issuerIdentity = this.issuerIdentity();
    const session: MutableScreeningIssuerSession = {
      id,
      state: randomId("state"),
      redirectUri: input.redirectUri,
      issuerOrigin: input.issuerOrigin,
      issuerDid: issuerIdentity.did,
      issuerMethodId: toHex(
        issuerIdentity.signer.verificationMethodRef.methodId,
      ),
      checks: {
        nationalIdPresentationVerified: true,
        sanctionsChecked: false,
        pepChecked: false,
        profileApproved: false,
      },
      status: "created",
      tokenConsumed: false,
    };
    this.sessions.set(id, session);

    return {
      session: publicSession(session),
      redirectUrl: `${input.issuerOrigin}/screening-issuer.html?session=${encodeURIComponent(id)}`,
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
    if (checks.every((check) => session.checks[check])) {
      session.status = "checks_completed";
    }
    return publicSession(session);
  }

  completeChecks(sessionId: string): {
    readonly session: ScreeningIssuerSessionState;
    readonly redirectUrl: string;
  } {
    const session = this.requireSession(sessionId);
    if (!checks.every((check) => session.checks[check])) {
      throw new Error("All Screening issuer checks must pass first");
    }

    session.preAuthorizedCode = randomId("preauth");
    const offer = createPreAuthorizedCredentialOffer({
      credentialIssuer: session.issuerOrigin,
      credentialConfigurationIds: [SCREENING_CREDENTIAL_CONFIGURATION_ID],
      preAuthorizedCode: session.preAuthorizedCode,
    });
    session.credentialOfferUri = credentialOfferUri({
      issuerOrigin: session.issuerOrigin,
      offer,
    });
    session.status = "offer_issued";

    const redirect = new URL(session.redirectUri);
    redirect.searchParams.set(
      "credential_offer_uri",
      session.credentialOfferUri,
    );
    redirect.searchParams.set("issuer_session", session.id);
    redirect.searchParams.set("issuer_kind", "screening");
    redirect.searchParams.set("state", session.state);

    return {
      session: publicSession(session),
      redirectUrl: redirect.toString(),
    };
  }

  createTokenRequest(credentialOfferUriValue: string): TokenRequest {
    const offer = parseCredentialOfferUri(credentialOfferUriValue);
    return createPreAuthorizedTokenRequest({ offer });
  }

  exchangeToken(request: TokenRequest): TokenResponse {
    const session = this.findByPreAuthorizedCode(
      request["pre-authorized_code"],
    );
    if (session.tokenConsumed) {
      throw new Error("Pre-authorized code has already been used");
    }
    session.tokenConsumed = true;
    session.status = "token_issued";
    session.accessToken = randomId("access");
    return {
      access_token: session.accessToken,
      token_type: "Bearer",
      expires_in: 300,
      c_nonce: toHex(sha256(`screening-c-nonce:${session.id}`)),
      c_nonce_expires_in: 300,
    };
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
    readonly inventory: WalletCredentialInventory;
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
      inventory: input.inventory,
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
    readonly inventory: WalletCredentialInventory;
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
      inventory: input.inventory,
    });
  }

  offerFromUri(credentialOfferUriValue: string): CredentialOffer {
    return parseCredentialOfferUri(credentialOfferUriValue);
  }

  private requireSession(id: string): MutableScreeningIssuerSession {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Screening issuer session "${id}" was not found`);
    }
    return session;
  }

  private findByPreAuthorizedCode(
    preAuthorizedCode: string,
  ): MutableScreeningIssuerSession {
    for (const session of this.sessions.values()) {
      if (session.preAuthorizedCode === preAuthorizedCode) return session;
    }
    throw new Error("Unknown pre-authorized code");
  }

  private findByAccessToken(
    accessToken: string,
  ): MutableScreeningIssuerSession {
    for (const session of this.sessions.values()) {
      if (session.accessToken === accessToken) return session;
    }
    throw new Error("Unknown access token");
  }
}
