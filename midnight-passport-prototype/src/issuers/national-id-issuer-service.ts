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
  encodeSecretPassportCredential,
  encodeSecretPassportProof,
  type PassportCredentialFixture,
} from "@midnight-ntwrk/midnight-did-credentials-passport-secret";

import { NationalIdIssuerAgent } from "../actors/national-id-issuer.js";
import { sha256 } from "../crypto/secure-store.js";
import type { HolderSecretMaterial } from "../types.js";
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

export const NATIONAL_ID_CREDENTIAL_CONFIGURATION_ID =
  "midnight_passport_national_id_v1";

export type NationalIdIssuerCheck =
  | "documentsUploaded"
  | "livenessPassed"
  | "profileApproved";

type NationalIdIssuerStatus =
  | "created"
  | "checks_completed"
  | "offer_issued"
  | "token_issued"
  | "credential_issued";

export type NationalIdIssuerSessionState = PublicIssuerSession<
  NationalIdIssuerCheck,
  NationalIdIssuerStatus
>;

export type NationalIdIssuedCredential = {
  readonly response: CredentialResponse;
  readonly credential: PassportCredentialFixture;
};

type MutableNationalIdIssuerSession = IssuerSessionRecord<
  NationalIdIssuerCheck,
  NationalIdIssuerStatus
>;

const checks: readonly NationalIdIssuerCheck[] = [
  "documentsUploaded",
  "livenessPassed",
  "profileApproved",
];

const publicSession = (
  session: MutableNationalIdIssuerSession,
): NationalIdIssuerSessionState => publicIssuerSession(session);

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
    const issuerIdentity = this.issuerIdentity();
    const session = createIssuerSession({
      idPrefix: "nid",
      redirectUri: input.redirectUri,
      issuerOrigin: input.issuerOrigin,
      issuerDid: issuerIdentity.did,
      issuerMethodId: issuerIdentity.signer.verificationMethodRef.methodId,
      checks: {
        documentsUploaded: false,
        livenessPassed: false,
        profileApproved: false,
      },
      status: "created",
    });
    this.sessions.set(session.id, session);

    return {
      session: publicSession(session),
      redirectUrl: createIssuerRedirect({
        issuerOrigin: input.issuerOrigin,
        page: "national-id-issuer.html",
        sessionId: session.id,
      }),
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
    if (allChecksPassed(session, checks)) {
      session.status = "checks_completed";
    }
    return publicSession(session);
  }

  completeChecks(sessionId: string): {
    readonly session: NationalIdIssuerSessionState;
    readonly redirectUrl: string;
  } {
    const session = this.requireSession(sessionId);
    if (!allChecksPassed(session, checks)) {
      throw new Error("All National ID issuer checks must pass first");
    }

    const redirectUrl = createOfferCallback(session, {
      credentialConfigurationId: NATIONAL_ID_CREDENTIAL_CONFIGURATION_ID,
      issuerKind: "national-id",
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
      nonceLabel: "issuer-c-nonce",
    });
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
    return parseCredentialOffer(credentialOfferUriValue);
  }

  private requireSession(id: string): MutableNationalIdIssuerSession {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`National ID issuer session "${id}" was not found`);
    }
    return session;
  }

  private findByAccessToken(
    accessToken: string,
  ): MutableNationalIdIssuerSession {
    return findByAccessToken(this.sessions.values(), accessToken);
  }
}
