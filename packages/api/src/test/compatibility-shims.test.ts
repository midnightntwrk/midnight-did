import { describe, expect, it } from "vitest";

import * as contractLifecycle from "../contract-lifecycle.js";
import * as deploy from "../deploy.js";
import * as didOperations from "../did-operations.js";
import * as update from "../update.js";

const expectSameExports = (
  shim: Record<string, unknown>,
  source: Record<string, unknown>,
) => {
  expect(Object.keys(shim).sort()).toEqual(Object.keys(source).sort());
  for (const name of Object.keys(source)) {
    expect(shim[name]).toBe(source[name]);
  }
};

describe("api compatibility shims", () => {
  it("keeps contract-lifecycle wired to deploy exports", () => {
    expectSameExports(contractLifecycle, deploy);
  });

  it("keeps did-operations wired to update exports", () => {
    expectSameExports(didOperations, update);
  });
});
