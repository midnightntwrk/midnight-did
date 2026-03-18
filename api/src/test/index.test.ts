import { describe, expect, it } from "vitest";

import * as api from "../index.js";

describe("api package barrel", () => {
  it("re-exports public mapping helpers", () => {
    expect(api.DomainToRuntime).toBeDefined();
    expect(api.RuntimeToDomain).toBeDefined();
  });
});
