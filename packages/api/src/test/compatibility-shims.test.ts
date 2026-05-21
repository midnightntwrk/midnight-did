import { describe, expect, it } from "vitest";

import * as contractLifecycle from "../contract-lifecycle.js";
import * as deploy from "../deploy.js";
import * as didOperations from "../did-operations.js";
import * as update from "../update.js";

describe("api compatibility shims", () => {
  it("keeps contract-lifecycle wired to deploy exports", () => {
    expect(contractLifecycle.deploy).toBe(deploy.deploy);
    expect(contractLifecycle.joinContract).toBe(deploy.joinContract);
    expect(contractLifecycle.getMidnightDIDLedgerState).toBe(
      deploy.getMidnightDIDLedgerState,
    );
  });

  it("keeps did-operations wired to update exports", () => {
    expect(didOperations.addVerificationMethod).toBe(
      update.addVerificationMethod,
    );
    expect(didOperations.updateVerificationMethod).toBe(
      update.updateVerificationMethod,
    );
    expect(didOperations.resolve).toBe(update.resolve);
  });
});
