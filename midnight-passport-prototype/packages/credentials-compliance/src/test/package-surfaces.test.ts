import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const sourceSurface = (relativePath: string) =>
  path.resolve(packageRoot, "src", relativePath);

const distSurface = (relativePath: string) =>
  path.resolve(packageRoot, "dist", relativePath);
const distRoot = path.resolve(packageRoot, "dist");

describe("compliance package surfaces", () => {
  it("keeps the standalone and composable Compact entrypoints in source control", () => {
    expect(
      existsSync(sourceSurface("sanction-screening-credential.compact")),
    ).toEqual(true);
    expect(
      existsSync(
        sourceSurface("sanction-screening-credential/composable.compact"),
      ),
    ).toEqual(true);
  });

  it("publishes the standalone and composable Compact entrypoints after build", () => {
    if (!existsSync(distRoot)) {
      return;
    }
    expect(
      existsSync(distSurface("sanction-screening-credential.compact")),
    ).toEqual(true);
    expect(
      existsSync(
        distSurface("sanction-screening-credential/composable.compact"),
      ),
    ).toEqual(true);
  });
});
