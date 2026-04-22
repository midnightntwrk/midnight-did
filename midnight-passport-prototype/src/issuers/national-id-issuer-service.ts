import { URL } from "node:url";

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
import {
  encodeSecretPassportCredential,
  encodeSecretPassportProof,
  type PassportCredentialFixture,
} from "@midnight-ntwrk/midnight-did-credentials-passport-secret";

import { NationalIdIssuerAgent } from "../actors/national-id-issuer.js";
import { sha256 } from "../crypto/secure-store.js";
import type { HolderSecretMaterial } from "../types.js";

export const NATIONAL_ID_CREDENTIAL_CONFIGURATION_ID =
  "midnight_passport_national_id_v1";

export type NationalIdIssuerCheck =
  | "documentsUploaded"
  | "livenessPassed"
  | "profileApproved";

export type NationalIdIssuerSessionState = {
  readonly id: string;
  readonly state: string;
  readonly redirectUri: string;
  readonly issuerOrigin: string;
  readonly issuerDid: string;
  readonly issuerMethodId: string;
  readonly checks: Record<NationalIdIssuerCheck, boolean>;
  readonly status:
    | "created"
    | "checks_completed"
    | "offer_issued"
    | "token_issued"
    | "credential_issued";
  readonly credentialOfferUri?: string;
};

export type NationalIdIssuedCredential = {
  readonly response: CredentialResponse;
  readonly credential: PassportCredentialFixture;
};

type MutableNationalIdIssuerSession = {
  id: string;
  state: string;
  redirectUri: string;
  issuerOrigin: string;
  issuerDid: string;
  issuerMethodId: string;
  checks: Record<NationalIdIssuerCheck, boolean>;
  status: NationalIdIssuerSessionState["status"];
  preAuthorizedCode?: string;
  accessToken?: string;
  credentialOfferUri?: string;
  tokenConsumed: boolean;
};

const checks: readonly NationalIdIssuerCheck[] = [
  "documentsUploaded",
  "livenessPassed",
  "profileApproved",
];

const toHex = (value: Uint8Array): string =>
  `0x${[...value].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;

const randomId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const publicSession = (
  session: MutableNationalIdIssuerSession,
): NationalIdIssuerSessionState => ({
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

export class NationalIdIssuerService {
  private readonly sessions = new Map<string, MutableNationalIdIssuerSession>();
  private readonly issuer = new NationalIdIssuerAgent();

  issuerIdentity(): ReturnType<NationalIdIssuerAgent["identity"]> {
    return this.issuer.identity();
  }

  metadata(issuerOrigin: string): CredentialIssuerMetadata {
    return createCredentialIssuerMetadata({
      credential_issuer: issuerOrigin,
      credential_endpoint: `${issuerOrigin}/api/issuer/national-id/credential`,
      token_endpoint: `${issuerOrigin}/api/issuer/national-id/token`,
      credential_configurations_supported: {
        [NATIONAL_ID_CREDENTIAL_CONFIGURATION_ID]: {
          format: "midnight_compact_vc",
          scope: "national_id",
          cryptographic_binding_methods_supported: [
            "blinded_secret_commitment",
          ],
          proof_types_supported: {
            jwt: {
              proof_signing_alg_values_supported: ["EdDSA", "ES256"],
            },
          },
          display: [{ name: "Digital National ID" }],
          credential_definition: {
            issuerDid: this.issuerIdentity().did,
            issuerKeyType: "jubjub",
          },
        },
      },
    });
  }

  start(input: {
    readonly issuerOrigin: string;
    readonly redirectUri: string;
  }): {
    readonly session: NationalIdIssuerSessionState;
    readonly redirectUrl: string;
  } {
    const id = randomId("nid");
    const issuerIdentity = this.issuerIdentity();
    const session: MutableNationalIdIssuerSession = {
      id,
      state: randomId("state"),
      redirectUri: input.redirectUri,
      issuerOrigin: input.issuerOrigin,
      issuerDid: issuerIdentity.did,
      issuerMethodId: toHex(
        issuerIdentity.signer.verificationMethodRef.methodId,
      ),
      checks: {
        documentsUploaded: false,
        livenessPassed: false,
        profileApproved: false,
      },
      status: "created",
      tokenConsumed: false,
    };
    this.sessions.set(id, session);

    return {
      session: publicSession(session),
      redirectUrl: `${input.issuerOrigin}/national-id-issuer.html?session=${encodeURIComponent(id)}`,
    };
  }

  getSession(id: string): NationalIdIssuerSessionState {
    return publicSession(this.requireSession(id));
  }

  setCheck(input: {
    readonly sessionId: string;
    readonly check: NationalIdIssuerCheck;
    readonly value: boolean;
  }): NationalIdIssuerSessionState {
    if (!checks.includes(input.check)) {
      throw new Error(`Unknown National ID check "${input.check}"`);
    }
    const session = this.requireSession(input.sessionId);
    session.checks[input.check] = input.value;
    if (checks.every((check) => session.checks[check])) {
      session.status = "checks_completed";
    }
    return publicSession(session);
  }

  completeChecks(sessionId: string): {
    readonly session: NationalIdIssuerSessionState;
    readonly redirectUrl: string;
  } {
    const session = this.requireSession(sessionId);
    if (!checks.every((check) => session.checks[check])) {
      throw new Error("All National ID issuer checks must pass first");
    }

    session.preAuthorizedCode = randomId("preauth");
    const offer = createPreAuthorizedCredentialOffer({
      credentialIssuer: session.issuerOrigin,
      credentialConfigurationIds: [NATIONAL_ID_CREDENTIAL_CONFIGURATION_ID],
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
      c_nonce: toHex(sha256(`issuer-c-nonce:${session.id}`)),
      c_nonce_expires_in: 300,
    };
  }

  createCredentialRequest(input: {
    readonly holder: HolderSecretMaterial;
    readonly token: TokenResponse;
  }): CredentialRequest {
    return createCredentialRequest({
      credential_configuration_id: NATIONAL_ID_CREDENTIAL_CONFIGURATION_ID,
      format: "midnight_compact_vc",
      proof: {
        proof_type: "jwt",
        jwt: `prototype-ed25519-pop.${input.token.c_nonce ?? "nonce"}`,
      },
      midnight: {
        holderBinding: {
          method: "blinded_secret_commitment",
          challenge: input.token.c_nonce ?? toHex(sha256("issuer-c-nonce")),
          blindedCommitment: toHex(input.holder.passportBlindingFactor),
          verifierDomain: "national-id-issuer.prototype",
        },
        requestedClaims: ["ageOver18", "notExpired", "issuingCountry"],
      },
    });
  }

  issueCredential(input: {
    readonly accessToken: string;
    readonly request: CredentialRequest;
    readonly holder: HolderSecretMaterial;
  }): NationalIdIssuedCredential {
    const session = this.findByAccessToken(input.accessToken);
    if (
      input.request.credential_configuration_id !==
      NATIONAL_ID_CREDENTIAL_CONFIGURATION_ID
    ) {
      throw new Error("Unsupported credential configuration");
    }
    if (
      input.request.midnight?.holderBinding.method !==
      "blinded_secret_commitment"
    ) {
      throw new Error("National ID issuance requires blinded holder binding");
    }

    const credential = this.issuer.issueCredential(input.holder);
    session.status = "credential_issued";
    const response = createCredentialResponse({
      credential: {
        format: "midnight_compact_vc",
        credentialFamily: "passport-secret",
        schemaId: "national-id-proxy:v1",
        schemaVersion: "1.0",
        credential: encodeSecretPassportCredential(credential.credential),
        credentialProof: encodeSecretPassportProof(credential.credentialProof),
        holderBinding: input.request.midnight.holderBinding,
      },
      c_nonce: toHex(sha256(`issuer-next-c-nonce:${session.id}`)),
      c_nonce_expires_in: 300,
    });

    return { response, credential };
  }

  redeemOffer(input: {
    readonly credentialOfferUri: string;
    readonly holder: HolderSecretMaterial;
  }): NationalIdIssuedCredential {
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
    return parseCredentialOfferUri(credentialOfferUriValue);
  }

  private requireSession(id: string): MutableNationalIdIssuerSession {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`National ID issuer session "${id}" was not found`);
    }
    return session;
  }

  private findByPreAuthorizedCode(
    preAuthorizedCode: string,
  ): MutableNationalIdIssuerSession {
    for (const session of this.sessions.values()) {
      if (session.preAuthorizedCode === preAuthorizedCode) return session;
    }
    throw new Error("Unknown pre-authorized code");
  }

  private findByAccessToken(
    accessToken: string,
  ): MutableNationalIdIssuerSession {
    for (const session of this.sessions.values()) {
      if (session.accessToken === accessToken) return session;
    }
    throw new Error("Unknown access token");
  }
}
