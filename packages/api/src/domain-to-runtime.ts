import {
  DOMAIN_TO_RUNTIME_NETWORK_MAP,
  type DomainToRuntimeNetworkMap,
} from "./network-mapping.js";

export class DomainToRuntime {
  static get NetworkMap(): DomainToRuntimeNetworkMap {
    return DOMAIN_TO_RUNTIME_NETWORK_MAP;
  }
}
