#!/usr/bin/env node
// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Linkinator 8.0.1's queue rescue interval is unreferenced. An early retry
// timer can leave queued work and an unsettled main() with no active handle.
// A referenced deadline lets that interval run, but fails genuine hangs closed.
export async function runWithDeadline(run, timeoutMs = 10 * 60 * 1000) {
  const deadline = setTimeout(() => {
    console.error(
      "Linkinator exceeded its process deadline; crawl incomplete.",
    );
    process.exit(124);
  }, timeoutMs);
  try {
    await run();
  } finally {
    clearTimeout(deadline);
  }
}

function findLinkinator() {
  for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!directory) continue;
    // pnpm exposes a shell shim in .bin, not necessarily a symlink to JS.
    const manifestPath = path.resolve(
      directory,
      "..",
      "linkinator",
      "package.json",
    );
    let source;
    try {
      source = readFileSync(manifestPath, "utf8");
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") continue;
      throw error;
    }
    const manifest = JSON.parse(source);
    const bin =
      typeof manifest.bin === "string"
        ? manifest.bin
        : manifest.bin?.linkinator;
    if (manifest.name !== "linkinator" || typeof bin !== "string") {
      throw new Error("Invalid dlx linkinator package manifest.");
    }
    return realpathSync(path.resolve(path.dirname(manifestPath), bin));
  }
  throw new Error(
    "linkinator executable not found; run through pinned pnpm dlx.",
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const cli = findLinkinator();
  process.argv = [process.execPath, cli, ...process.argv.slice(2)];
  await runWithDeadline(() => import(pathToFileURL(cli).href));
}
