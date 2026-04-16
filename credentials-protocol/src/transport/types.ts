import type { ProtocolMessageEnvelope } from "../../../credentials/src/managed/credentials/contract/index.js";

export type PartyId = string;

export type ProtocolMessageType =
  | "issuance:offer"
  | "issuance:request"
  | "issuance:result"
  | "presentation:request"
  | "presentation:submission"
  | "presentation:result";

export type ProtocolMessage<TBody = unknown> = {
  readonly type: ProtocolMessageType;
  readonly from: PartyId;
  readonly to: PartyId;
  readonly envelope: ProtocolMessageEnvelope;
  readonly body: TBody;
};
