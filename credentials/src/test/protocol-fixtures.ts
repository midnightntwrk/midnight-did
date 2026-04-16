import { createHash } from "node:crypto";

import {
  type ProtocolMessageEnvelope,
  pureCircuits,
} from "../managed/credentials/contract/index.js";

const sha256 = (value: string): Uint8Array =>
  new Uint8Array(createHash("sha256").update(value).digest());

export const createProtocolEnvelope = ({
  label,
  threadLabel,
  initialMessage,
  respondsToMessageId,
  createdAt,
  expiresAt,
}: {
  readonly label: string;
  readonly threadLabel: string;
  readonly initialMessage: boolean;
  readonly respondsToMessageId?: Uint8Array;
  readonly createdAt: bigint;
  readonly expiresAt?: bigint;
}): ProtocolMessageEnvelope => ({
  version: 1n,
  messageId: sha256(`protocol:message:${label}`),
  threadId: sha256(`protocol:thread:${threadLabel}`),
  initialMessage,
  respondsToMessageId:
    respondsToMessageId ?? pureCircuits.noProtocolResponseReference(),
  createdAt,
  hasExpiresAt: expiresAt !== undefined,
  expiresAt: expiresAt ?? 0n,
});
