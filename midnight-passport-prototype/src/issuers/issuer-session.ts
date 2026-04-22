import { URL } from "node:url";

import {
  createPreAuthorizedCredentialOffer,
  createPreAuthorizedTokenRequest,
  type CredentialOffer,
  credentialOfferUri,
  parseCredentialOfferUri,
  type TokenRequest,
  type TokenResponse,
} from "@midnight-ntwrk/midnight-did-credentials-openid";

import { sha256 } from "../crypto/secure-store.js";

export type IssuerLifecycleStatus =
  | "created"
  | "checks_completed"
  | "offer_issued"
  | "token_issued"
  | "credential_issued"
  | "denied";

export type IssuerSessionRecord<
  Check extends string,
  Status extends IssuerLifecycleStatus = IssuerLifecycleStatus,
> = {
  id: string;
  state: string;
  redirectUri: string;
  issuerOrigin: string;
  issuerDid: string;
  issuerMethodId: string;
  checks: Record<Check, boolean>;
  status: Status;
  denialReason?: string;
  preAuthorizedCode?: string;
  accessToken?: string;
  credentialOfferUri?: string;
  tokenConsumed: boolean;
};

export type PublicIssuerSession<
  Check extends string,
  Status extends IssuerLifecycleStatus,
> = {
  readonly id: string;
  readonly state: string;
  readonly redirectUri: string;
  readonly issuerOrigin: string;
  readonly issuerDid: string;
  readonly issuerMethodId: string;
  readonly checks: Record<Check, boolean>;
  readonly status: Status;
  readonly denialReason?: string;
  readonly credentialOfferUri?: string;
};

export const toHex = (value: Uint8Array): string =>
  `0x${[...value].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;

export const randomIssuerId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const publicIssuerSession = <
  Check extends string,
  Status extends IssuerLifecycleStatus,
>(
  session: IssuerSessionRecord<Check, Status>,
): PublicIssuerSession<Check, Status> => ({
  id: session.id,
  state: session.state,
  redirectUri: session.redirectUri,
  issuerOrigin: session.issuerOrigin,
  issuerDid: session.issuerDid,
  issuerMethodId: session.issuerMethodId,
  checks: { ...session.checks },
  status: session.status,
  denialReason: session.denialReason,
  credentialOfferUri: session.credentialOfferUri,
});

export const createIssuerSession = <
  Check extends string,
  Status extends IssuerLifecycleStatus,
>(input: {
  readonly idPrefix: string;
  readonly redirectUri: string;
  readonly issuerOrigin: string;
  readonly issuerDid: string;
  readonly issuerMethodId: Uint8Array;
  readonly checks: Record<Check, boolean>;
  readonly status: Status;
}): IssuerSessionRecord<Check, Status> => ({
  id: randomIssuerId(input.idPrefix),
  state: randomIssuerId("state"),
  redirectUri: input.redirectUri,
  issuerOrigin: input.issuerOrigin,
  issuerDid: input.issuerDid,
  issuerMethodId: toHex(input.issuerMethodId),
  checks: input.checks,
  status: input.status,
  tokenConsumed: false,
});

export const createIssuerRedirect = (input: {
  readonly issuerOrigin: string;
  readonly page: string;
  readonly sessionId: string;
}): string =>
  `${input.issuerOrigin}/${input.page}?session=${encodeURIComponent(input.sessionId)}`;

export const allChecksPassed = <Check extends string>(
  session: IssuerSessionRecord<Check>,
  checks: readonly Check[],
): boolean => checks.every((check) => session.checks[check]);

export const createOfferCallback = <Check extends string>(
  session: IssuerSessionRecord<Check>,
  input: {
    readonly credentialConfigurationId: string;
    readonly issuerKind: string;
  },
): string => {
  session.preAuthorizedCode = randomIssuerId("preauth");
  const offer = createPreAuthorizedCredentialOffer({
    credentialIssuer: session.issuerOrigin,
    credentialConfigurationIds: [input.credentialConfigurationId],
    preAuthorizedCode: session.preAuthorizedCode,
  });
  session.credentialOfferUri = credentialOfferUri({
    issuerOrigin: session.issuerOrigin,
    offer,
  });
  session.status = "offer_issued";

  const redirect = new URL(session.redirectUri);
  redirect.searchParams.set("credential_offer_uri", session.credentialOfferUri);
  redirect.searchParams.set("issuer_session", session.id);
  redirect.searchParams.set("issuer_kind", input.issuerKind);
  redirect.searchParams.set("state", session.state);
  return redirect.toString();
};

export const createTokenRequestFromOffer = (
  credentialOfferUriValue: string,
): TokenRequest => {
  const offer = parseCredentialOfferUri(credentialOfferUriValue);
  return createPreAuthorizedTokenRequest({ offer });
};

export const findByPreAuthorizedCode = <
  Session extends IssuerSessionRecord<string>,
>(
  sessions: Iterable<Session>,
  preAuthorizedCode: string,
): Session => {
  for (const session of sessions) {
    if (session.preAuthorizedCode === preAuthorizedCode) return session;
  }
  throw new Error("Unknown pre-authorized code");
};

export const findByAccessToken = <Session extends IssuerSessionRecord<string>>(
  sessions: Iterable<Session>,
  accessToken: string,
): Session => {
  for (const session of sessions) {
    if (session.accessToken === accessToken) return session;
  }
  throw new Error("Unknown access token");
};

export const exchangePreAuthorizedToken = <
  Session extends IssuerSessionRecord<string>,
>(input: {
  readonly sessions: Iterable<Session>;
  readonly request: TokenRequest;
  readonly nonceLabel: string;
}): TokenResponse => {
  const session = findByPreAuthorizedCode(
    input.sessions,
    input.request["pre-authorized_code"],
  );
  if (session.tokenConsumed) {
    throw new Error("Pre-authorized code has already been used");
  }
  session.tokenConsumed = true;
  session.status = "token_issued";
  session.accessToken = randomIssuerId("access");
  return {
    access_token: session.accessToken,
    token_type: "Bearer",
    expires_in: 300,
    c_nonce: toHex(sha256(`${input.nonceLabel}:${session.id}`)),
    c_nonce_expires_in: 300,
  };
};

export const parseCredentialOffer = (
  credentialOfferUriValue: string,
): CredentialOffer => parseCredentialOfferUri(credentialOfferUriValue);
