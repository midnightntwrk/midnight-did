import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { RuntimeToDomainNetworkMap } from "../index.js";
import type { RuntimeToDomainNetworkMap as InternalRuntimeToDomainNetworkMap } from "../network-mapping.js";

vi.mock("@midnight-ntwrk/midnight-js-http-client-proof-provider", () => {
  throw new Error(
    "Barrel import loaded provider adapter @midnight-ntwrk/midnight-js-http-client-proof-provider",
  );
});

vi.mock("@midnight-ntwrk/midnight-js-indexer-public-data-provider", () => {
  throw new Error(
    "Barrel import loaded provider adapter @midnight-ntwrk/midnight-js-indexer-public-data-provider",
  );
});

vi.mock("@midnight-ntwrk/midnight-js-node-zk-config-provider", () => {
  throw new Error(
    "Barrel import loaded provider adapter @midnight-ntwrk/midnight-js-node-zk-config-provider",
  );
});

describe("api package barrel", () => {
  it("re-exports public mapping helpers without loading provider adapters", async () => {
    const api = await import("../index.js");

    expect(api.DomainToRuntime).toBeDefined();
    expect(api.RuntimeToDomain).toBeDefined();
    expectTypeOf<RuntimeToDomainNetworkMap>().toEqualTypeOf<InternalRuntimeToDomainNetworkMap>();
  });

  it("keeps public lib runtime exports available through the package barrel", async () => {
    const [api, lib] = await Promise.all([
      import("../index.js"),
      import("../lib.js"),
    ]);
    const libRuntimeExportNames = [
      "addAlsoKnownAs",
      "addService",
      "addVerificationMethod",
      "addVerificationMethodRelation",
      "buildFreshWallet",
      "buildWallet",
      "buildWalletAndWaitForFunds",
      "configureProviders",
      "createDID",
      "createWalletAndMidnightProvider",
      "deactivate",
      "deploy",
      "deriveUnshieldedAddressFromSeed",
      "getMidnightDIDLedgerState",
      "getMidnightNetwork",
      "getWalletBalances",
      "initPrivateState",
      "joinContract",
      "midnightDIDContractInstance",
      "registerForDustGeneration",
      "removeAlsoKnownAs",
      "removeService",
      "removeVerificationMethod",
      "removeVerificationMethodRelation",
      "resolve",
      "restoreWalletFromState",
      "serializeWalletState",
      "setLogger",
      "updateService",
      "updateVerificationMethod",
      "waitForWalletFunds",
      "waitForWalletSync",
    ];

    expect(Object.keys(lib).sort()).toEqual([...libRuntimeExportNames].sort());
    for (const exportName of libRuntimeExportNames) {
      expect(api[exportName as keyof typeof api]).toBe(
        lib[exportName as keyof typeof lib],
      );
    }
  });
});
