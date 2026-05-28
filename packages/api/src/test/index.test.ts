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
    // Intentional tripwire: adding or removing a lib runtime export requires
    // updating the public barrel and this list together.
    const libRuntimeExportNames = [
      "addAlsoKnownAs",
      "addSchnorrJubjubVerificationMethod",
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
      "removeSchnorrJubjubVerificationMethod",
      "removeService",
      "removeVerificationMethod",
      "removeVerificationMethodRelation",
      "resolve",
      "restoreWalletFromState",
      "serializeWalletState",
      "setLogger",
      "updateSchnorrJubjubVerificationMethod",
      "updateService",
      "updateVerificationMethod",
      "verifySchnorrJubjubDigestSignature",
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

  it("keeps the package root runtime export surface explicit", async () => {
    const api = await import("../index.js");
    // Intentional package-root catalog: update this list when adding or
    // removing runtime exports from the public API package entry point.
    const apiRuntimeExportNames = [
      "BigIntReplacer",
      "DomainToRuntime",
      "MainnetConfig",
      "MIDNIGHT_NETWORK_PROFILES",
      "MIDNIGHT_NETWORK_PROFILE_NAMES",
      "MidnightDIDPrivateStateId",
      "NetworkMapping",
      "PreprodConfig",
      "ProfileConfig",
      "RuntimeToDomain",
      "StandaloneConfig",
      "TestnetLocalConfig",
      "TestnetRemoteConfig",
      "addAlsoKnownAs",
      "addSchnorrJubjubVerificationMethod",
      "addService",
      "addVerificationMethod",
      "addVerificationMethodRelation",
      "applyMidnightNetworkProfile",
      "buildFreshWallet",
      "buildWallet",
      "buildWalletAndWaitForFunds",
      "configureProviders",
      "contractConfig",
      "createDID",
      "createLogger",
      "createWalletAndMidnightProvider",
      "currentDir",
      "deactivate",
      "deploy",
      "deriveUnshieldedAddressFromSeed",
      "getMidnightDIDLedgerState",
      "getMidnightNetwork",
      "getMidnightNetworkProfile",
      "getWalletBalances",
      "initPrivateState",
      "isMidnightNetworkProfileName",
      "joinContract",
      "midnightDIDContractInstance",
      "registerForDustGeneration",
      "removeAlsoKnownAs",
      "removeSchnorrJubjubVerificationMethod",
      "removeService",
      "removeVerificationMethod",
      "removeVerificationMethodRelation",
      "resolve",
      "resolveMidnightNetworkConfig",
      "restoreWalletFromState",
      "serializeWalletState",
      "setLogger",
      "updateSchnorrJubjubVerificationMethod",
      "updateService",
      "updateVerificationMethod",
      "verifySchnorrJubjubDigestSignature",
      "waitForWalletFunds",
      "waitForWalletSync",
    ];

    expect(Object.keys(api).sort()).toEqual([...apiRuntimeExportNames].sort());
  });
});
