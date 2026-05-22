import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { RuntimeToDomainNetworkMap } from "../index.js";
import type { RuntimeToDomainNetworkMap as InternalRuntimeToDomainNetworkMap } from "../network-mapping.js";

const failOnEagerProviderAdapterImport = (specifier: string) => {
  throw new Error(`Barrel import loaded provider adapter ${specifier}`);
};

vi.mock("@midnight-ntwrk/midnight-js-http-client-proof-provider", () =>
  failOnEagerProviderAdapterImport(
    "@midnight-ntwrk/midnight-js-http-client-proof-provider",
  ),
);

vi.mock("@midnight-ntwrk/midnight-js-indexer-public-data-provider", () =>
  failOnEagerProviderAdapterImport(
    "@midnight-ntwrk/midnight-js-indexer-public-data-provider",
  ),
);

vi.mock("@midnight-ntwrk/midnight-js-node-zk-config-provider", () =>
  failOnEagerProviderAdapterImport(
    "@midnight-ntwrk/midnight-js-node-zk-config-provider",
  ),
);

describe("api package barrel", () => {
  it("re-exports public mapping helpers without loading provider adapters", async () => {
    const api = await import("../index.js");

    expect(api.DomainToRuntime).toBeDefined();
    expect(api.RuntimeToDomain).toBeDefined();
    expectTypeOf<RuntimeToDomainNetworkMap>().toEqualTypeOf<InternalRuntimeToDomainNetworkMap>();
  });
});
