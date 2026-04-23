import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../lib.js", () => ({}));

let api: typeof import("../index.js");

beforeAll(async () => {
  api = await import("../index.js");
});

describe("api package barrel", () => {
  it("re-exports public mapping helpers", () => {
    expect(api.DomainToRuntime).toBeDefined();
    expect(api.RuntimeToDomain).toBeDefined();
  });
});
