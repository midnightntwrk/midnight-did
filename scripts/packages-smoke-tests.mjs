#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "vite";

const workspaceRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distEntry = (packagePath, entry = "index.js") =>
  path.join(workspaceRoot, "packages", packagePath, "dist", entry);
const packageLinks = new Map([
  ["@midnight-ntwrk/midnight-did-api", "api"],
  ["@midnight-ntwrk/midnight-did-contract", "contract"],
  ["@midnight-ntwrk/midnight-did-domain", "domain"],
  ["@midnight-ntwrk/midnight-did", "did"],
  ["@midnight-ntwrk/midnight-did-jubjub-schnorr", "jubjub-schnorr"],
]);

const smoke = async (name, fn) => {
  try {
    await fn();
    console.log(`[packages-smoke-tests] ${name}: ok`);
  } catch (error) {
    console.error(`[packages-smoke-tests] ${name}: failed`);
    throw error;
  }
};

const linkPackagesForConsumer = async (consumerRoot) => {
  const scopeDir = path.join(consumerRoot, "node_modules", "@midnight-ntwrk");
  await mkdir(scopeDir, { recursive: true });

  for (const [packageName, packagePath] of packageLinks.entries()) {
    await symlink(
      path.join(workspaceRoot, "packages", packagePath),
      path.join(scopeDir, packageName.split("/")[1]),
      "dir",
    );
  }
};

await smoke("node package imports", async () => {
  let tempDir;
  try {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "midnight-did-node-smoke-"));
    await linkPackagesForConsumer(tempDir);
    const entry = path.join(tempDir, "node-entry.js");
    await writeFile(
      entry,
      `
        import * as api from "@midnight-ntwrk/midnight-did-api";
        import * as apiBrowser from "@midnight-ntwrk/midnight-did-api/browser";
        import * as contract from "@midnight-ntwrk/midnight-did-contract";
        import * as did from "@midnight-ntwrk/midnight-did";
        import * as domain from "@midnight-ntwrk/midnight-did-domain";
        import * as jubjubSchnorr from "@midnight-ntwrk/midnight-did-jubjub-schnorr";

        if (typeof jubjubSchnorr.TWO_248 !== "bigint") {
          throw new Error("jubjub-schnorr TWO_248 export is unavailable");
        }
        if (!contract.DIDContract) {
          throw new Error("contract DIDContract export is unavailable");
        }
        if (!domain.VerificationMethodType) {
          throw new Error("domain VerificationMethodType export is unavailable");
        }
        if (!did.LedgerToDomain) {
          throw new Error("did LedgerToDomain export is unavailable");
        }
        if (typeof api.createDID !== "function") {
          throw new Error("api createDID export is unavailable");
        }
        if (!apiBrowser.DomainToRuntime.NetworkMap) {
          throw new Error("api browser DomainToRuntime export is unavailable");
        }
        if (!apiBrowser.RuntimeToDomain.NetworkMap) {
          throw new Error("api browser RuntimeToDomain export is unavailable");
        }
        if (apiBrowser.parseSeed("00".repeat(32)).length !== 64) {
          throw new Error("api browser parseSeed returned an unexpected length");
        }
        if (apiBrowser.randomBytes(4).length !== 4) {
          throw new Error("api browser randomBytes returned an unexpected length");
        }
      `,
      "utf8",
    );
    await import(pathToFileURL(entry).href);
  } finally {
    if (tempDir) {
      await rm(tempDir, { force: true, recursive: true });
    }
  }
});

await smoke("browser bundle imports", async () => {
  let tempDir;
  try {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "midnight-did-smoke-"));
    const entry = path.join(tempDir, "browser-entry.js");
    await writeFile(
      entry,
      `
        import { DomainToRuntime, RuntimeToDomain, parseSeed, randomBytes } from "@midnight-ntwrk/midnight-did-api/browser";

        const parsedSeed = parseSeed("00".repeat(32));
        const random = randomBytes(4);

        if (!DomainToRuntime.NetworkMap || !RuntimeToDomain.NetworkMap || parsedSeed.length !== 64 || random.length !== 4) {
          throw new Error("api browser smoke exports are unavailable");
        }
      `,
      "utf8",
    );

    const result = await build({
      configFile: false,
      logLevel: "silent",
      plugins: [
        {
          name: "reject-node-builtins",
          resolveId(source) {
            if (source.startsWith("node:")) {
              throw new Error(`browser bundle imported Node.js builtin ${source}`);
            }
            return null;
          },
        },
      ],
      resolve: {
        alias: [
          {
            find: /^@midnight-ntwrk\/midnight-did-api\/browser$/,
            replacement: distEntry("api", "browser.js"),
          },
        ],
      },
      build: {
        emptyOutDir: true,
        outDir: path.join(tempDir, "dist"),
        write: false,
        rollupOptions: {
          input: entry,
        },
      },
    });

    const outputs = Array.isArray(result) ? result : [result];
    let outputItems = 0;
    for (const output of outputs) {
      for (const item of output.output) {
        outputItems += 1;
        const source =
          item.type === "chunk"
            ? item.code
            : typeof item.source === "string"
              ? item.source
              : "";
        if (source.includes("node:")) {
          throw new Error("browser bundle output contains a node: import");
        }
      }
    }
    if (outputItems === 0) {
      throw new Error("browser bundle produced no output");
    }
  } finally {
    if (tempDir) {
      await rm(tempDir, { force: true, recursive: true });
    }
  }
});
