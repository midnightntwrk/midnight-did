import type { MidnightNetwork } from "@midnight-ntwrk/midnight-did";
import type { NetworkId } from "@midnight-ntwrk/midnight-js-network-id";

import { RUNTIME_TO_DOMAIN_NETWORK_MAP } from "./network-mapping.js";

export class RuntimeToDomain {
  static get NetworkMap(): Record<NetworkId, MidnightNetwork> {
    return RUNTIME_TO_DOMAIN_NETWORK_MAP;
  }
}
