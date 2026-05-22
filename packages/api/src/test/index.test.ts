import { describe, expect, it, vi } from "vitest";

vi.mock("@midnight-ntwrk/midnight-js-http-client-proof-provider", () => ({
  httpClientProofProvider: vi.fn(),
}));

import * as api from "../index.js";

describe("api package barrel", () => {
  it("re-exports public mapping helpers", () => {
    expect(api.DomainToRuntime).toBeDefined();
    expect(api.RuntimeToDomain).toBeDefined();
  });
});
