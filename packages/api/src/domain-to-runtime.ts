import type { MidnightNetwork } from "@midnight-ntwrk/midnight-did";
import type { NetworkId } from "@midnight-ntwrk/midnight-js-network-id";

import { DOMAIN_TO_RUNTIME_NETWORK_MAP } from "./network-mapping.js";

export class DomainToRuntime {
  static get NetworkMap(): Record<MidnightNetwork, NetworkId> {
    return DOMAIN_TO_RUNTIME_NETWORK_MAP;
  }
}
