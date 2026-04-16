import {
  type ProtocolMessageEnvelope,
  pureCircuits as genericPureCircuits,
} from "../../../credentials/src/managed/credentials/contract/index.js";
import { sha256 } from "./crypto.js";

let envelopeCounter = 0;

export const createEnvelope = (
  label: string,
  threadLabel: string,
  initial: boolean,
  respondsTo?: Uint8Array,
  threadId?: Uint8Array,
): ProtocolMessageEnvelope => {
  const seq = envelopeCounter++;
  return {
    version: 1n,
    messageId: sha256(`protocol:message:${label}:${seq}`),
    threadId: threadId ?? sha256(`protocol:thread:${threadLabel}:${seq}`),
    initialMessage: initial,
    respondsToMessageId:
      respondsTo ?? genericPureCircuits.noProtocolResponseReference(),
    createdAt: BigInt(Date.now()),
    hasExpiresAt: false,
    expiresAt: 0n,
  };
};

/** Reset the envelope counter — for test isolation only. */
export const resetEnvelopeCounter = (): void => {
  envelopeCounter = 0;
};
