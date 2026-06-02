import {
  RUNTIME_TO_DOMAIN_NETWORK_MAP,
  type RuntimeToDomainNetworkMap,
} from "./network-mapping.js";

export class RuntimeToDomain {
  static get NetworkMap(): RuntimeToDomainNetworkMap {
    return RUNTIME_TO_DOMAIN_NETWORK_MAP;
  }
}
