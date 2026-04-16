/**
 * Lightweight runtime validation for protocol message bodies.
 *
 * These guards check that a message body has the expected shape before
 * casting. They do NOT perform deep schema validation — they verify that
 * key discriminating fields exist and the message type matches expectations.
 */

import type { ProtocolMessage, ProtocolMessageType } from "../transport/types.js";

export function assertMessageType(
  message: ProtocolMessage,
  expectedType: ProtocolMessageType,
): void {
  if (message.type !== expectedType) {
    throw new Error(
      `Expected message type "${expectedType}", got "${message.type}"`,
    );
  }
}

export function assertBodyHasFields(
  message: ProtocolMessage,
  fields: readonly string[],
): void {
  const body = message.body as Record<string, unknown>;
  if (body == null || typeof body !== "object") {
    throw new Error("Message body is null or not an object");
  }
  for (const field of fields) {
    if (!(field in body)) {
      throw new Error(
        `Message body (type="${message.type}") is missing required field "${field}"`,
      );
    }
  }
}
