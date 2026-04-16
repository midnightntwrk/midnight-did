import type { PartyId,ProtocolMessage } from "./types.js";

export class MessageBus {
  private readonly queues = new Map<PartyId, ProtocolMessage[]>();

  send(message: ProtocolMessage): void {
    const queue = this.queues.get(message.to) ?? [];
    queue.push(message);
    this.queues.set(message.to, queue);
  }

  receive(party: PartyId): ProtocolMessage | undefined {
    const queue = this.queues.get(party);
    if (!queue || queue.length === 0) return undefined;
    return queue.shift();
  }

  drain(party: PartyId): ProtocolMessage[] {
    const queue = this.queues.get(party) ?? [];
    this.queues.set(party, []);
    return queue;
  }

  pending(party: PartyId): number {
    return this.queues.get(party)?.length ?? 0;
  }
}
