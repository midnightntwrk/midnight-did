import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { RuntimeToDomainNetworkMap } from "../index.js";
import type { RuntimeToDomainNetworkMap as InternalRuntimeToDomainNetworkMap } from "../network-mapping.js";

// Keep the barrel test scoped to public re-exports; provider adapter modules
// are covered by provider-specific tests and pull in runtime-only clients.
vi.mock("@midnight-ntwrk/midnight-js-http-client-proof-provider", () => ({
  httpClientProofProvider: vi.fn(),
}));

import * as api from "../index.js";

describe("api package barrel", () => {
  it("re-exports public mapping helpers", () => {
    expect(api.DomainToRuntime).toBeDefined();
    expect(api.RuntimeToDomain).toBeDefined();
    expectTypeOf<RuntimeToDomainNetworkMap>().toEqualTypeOf<InternalRuntimeToDomainNetworkMap>();
  });
});
