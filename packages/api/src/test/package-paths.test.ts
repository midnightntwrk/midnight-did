import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import {
  createContractConfig,
  MIDNIGHT_DID_ZK_CONFIG_PATH_ENV,
  resolveApiPackageRoot,
  resolveDefaultZkConfigPath,
} from "../package-paths.js";

const moduleUrl = (absolutePath: string): string =>
  pathToFileURL(absolutePath).href;

describe("API package path resolution", () => {
  it("resolves the API package root from source modules", () => {
    expect(
      resolveApiPackageRoot(
        moduleUrl("/workspace/midnight-did/packages/api/src/config.ts"),
      ),
    ).toBe(path.resolve("/workspace/midnight-did/packages/api"));
  });

  it("resolves the API package root from dist modules", () => {
    expect(
      resolveApiPackageRoot(
        moduleUrl("/workspace/midnight-did/packages/api/dist/config.js"),
      ),
    ).toBe(path.resolve("/workspace/midnight-did/packages/api"));
  });

  it("resolves the API package root from nested dist source maps", () => {
    expect(
      resolveApiPackageRoot(
        moduleUrl("/workspace/midnight-did/packages/api/dist/src/config.js"),
      ),
    ).toBe(path.resolve("/workspace/midnight-did/packages/api"));
  });

  it("decodes URL-encoded filesystem paths before resolving package roots", () => {
    expect(
      resolveApiPackageRoot(
        "file:///workspace/midnight%20identity/packages/api/src/config.ts",
      ),
    ).toBe(path.resolve("/workspace/midnight identity/packages/api"));
  });

  it("derives the DID contract managed artifact directory from the API package root", () => {
    expect(
      createContractConfig("/workspace/midnight-did/packages/api"),
    ).toMatchObject({
      privateStateStoreName: "did-private-state",
      zkConfigPath: path.resolve(
        "/workspace/midnight-did/packages/contract/src/managed/did",
      ),
    });
  });

  it("prefers an explicit ZK artifact directory from the environment", () => {
    const previous = process.env[MIDNIGHT_DID_ZK_CONFIG_PATH_ENV];
    process.env[MIDNIGHT_DID_ZK_CONFIG_PATH_ENV] = "artifacts/zk/unpacked";

    try {
      expect(
        createContractConfig("/workspace/midnight-did/packages/api")
          .zkConfigPath,
      ).toBe(path.resolve("artifacts/zk/unpacked"));
    } finally {
      if (previous === undefined) {
        delete process.env[MIDNIGHT_DID_ZK_CONFIG_PATH_ENV];
      } else {
        process.env[MIDNIGHT_DID_ZK_CONFIG_PATH_ENV] = previous;
      }
    }
  });

  it("falls back to the source managed artifact directory when no candidate exists", () => {
    expect(
      resolveDefaultZkConfigPath("/workspace/midnight-did/packages/api"),
    ).toBe(
      path.resolve("/workspace/midnight-did/packages/contract/src/managed/did"),
    );
  });
});
