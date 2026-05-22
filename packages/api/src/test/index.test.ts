import { describe, expect, expectTypeOf, it } from "vitest";

import type { RuntimeToDomainNetworkMap } from "../index.js";
import * as api from "../index.js";
import type { RuntimeToDomainNetworkMap as InternalRuntimeToDomainNetworkMap } from "../network-mapping.js";

describe("api package barrel", () => {
  it("re-exports public mapping helpers", () => {
    expect(api.DomainToRuntime).toBeDefined();
    expect(api.RuntimeToDomain).toBeDefined();
    expectTypeOf<RuntimeToDomainNetworkMap>().toEqualTypeOf<InternalRuntimeToDomainNetworkMap>();
  });
});
