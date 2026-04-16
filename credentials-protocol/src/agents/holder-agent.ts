import { createHash } from "node:crypto";

import {
  type Proof,
  pureCircuits as genericPureCircuits,
  type ProtocolMessageEnvelope,
} from "../../../credentials/src/managed/credentials/contract/index.js";
import {
  type BirthCredential,
  type BirthCredentialIssuanceOffer,
  type BirthCredentialIssuanceRequest,
  type BirthCredentialIssuanceResult,
  HolderBindingProfile,
} from "../../../credentials-birth/src/managed/birth-credential/contract/index.js";

import type { DIDProfile } from "./types.js";
import type { ProtocolMessage } from "../transport/types.js";
import { MessageBus } from "../transport/message-bus.js";

const sha256 = (value: string): Uint8Array =>
  new Uint8Array(createHash("sha256").update(value).digest());

const createEnvelope = (
  label: string,
  threadLabel: string,
  initial: boolean,
  respondsTo?: Uint8Array,
): ProtocolMessageEnvelope => ({
  version: 1n,
  messageId: sha256(`protocol:message:${label}`),
  threadId: sha256(`protocol:thread:${threadLabel}`),
  initialMessage: initial,
  respondsToMessageId:
    respondsTo ?? genericPureCircuits.noProtocolResponseReference(),
  createdAt: BigInt(Date.now()),
  hasExpiresAt: false,
  expiresAt: 0n,
});

export type StoredCredential = {
  readonly credential: BirthCredential;
  readonly credentialProof: Proof;
};

export class HolderAgent {
  private readonly profile: DIDProfile;
  private readonly bus: MessageBus;
  private readonly credentials: StoredCredential[] = [];

  constructor(profile: DIDProfile, bus: MessageBus) {
    this.profile = profile;
    this.bus = bus;
  }

  receiveOfferAndSendRequest(offer: ProtocolMessage): void {
    if (offer.type !== "issuance:offer") {
      throw new Error(
        `Expected issuance:offer message, got ${offer.type}`,
      );
    }

    const issuanceOffer = offer.body as BirthCredentialIssuanceOffer;
    const challengeHash = sha256("challenge:issuance");

    const request: BirthCredentialIssuanceRequest = {
      envelope: createEnvelope(
        "issuance-request",
        "birth-issuance",
        false,
        issuanceOffer.envelope.messageId,
      ),
      schema: issuanceOffer.schema,
      issuerVerificationMethodRef: issuanceOffer.issuerVerificationMethodRef,
      holderBindingProfile: HolderBindingProfile.explicitDid,
      body: {
        holderBinding: {
          holderVerificationMethodRef:
            this.profile.signer.verificationMethodRef,
        },
        holderPublicKey: this.profile.signer.publicKey,
        holderChallengeHash: challengeHash,
        requestExpiration: true,
        requestedExpirationDays: 365n,
      },
    };

    this.bus.send({
      type: "issuance:request",
      from: this.profile.label,
      to: offer.from,
      envelope: request.envelope,
      body: request,
    });
  }

  receiveCredentialResult(result: ProtocolMessage): void {
    if (result.type !== "issuance:result") {
      throw new Error(
        `Expected issuance:result message, got ${result.type}`,
      );
    }

    const issuanceResult = result.body as BirthCredentialIssuanceResult;
    this.credentials.push({
      credential: issuanceResult.body.credential,
      credentialProof: issuanceResult.body.credentialProof,
    });
  }

  get credentialCount(): number {
    return this.credentials.length;
  }

  getCredential(index: number): StoredCredential {
    if (index < 0 || index >= this.credentials.length) {
      throw new RangeError(
        `Credential index ${index} out of range [0, ${this.credentials.length})`,
      );
    }
    return this.credentials[index];
  }
}
