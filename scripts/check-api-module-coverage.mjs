import { basename, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const protectedApiModuleThresholds = Object.freeze({
  "controller-authorization.ts": {
    statements: 90,
    branches: 75,
    functions: 90,
  },
  "controller-operations.ts": { statements: 90, branches: 90, functions: 80 },
  "contract-lifecycle-operations.ts": {
    statements: 70,
    branches: 70,
    functions: 60,
  },
  "service-operations.ts": { statements: 90, branches: 90, functions: 90 },
  "wallet-keys.ts": { statements: 80, branches: 50, functions: 90 },
  "verification-method-operations.ts": {
    statements: 100,
    branches: 90,
    functions: 100,
  },
  "wallet-context.ts": { statements: 100, branches: 100, functions: 100 },
  "wallet.ts": { statements: 100, branches: 100, functions: 100 },
});

const coverageKeys = Object.freeze({
  statements: "s",
  branches: "b",
  functions: "f",
});

const percentage = (counts) => {
  const values = counts.flat();
  if (values.length === 0) return 100;
  return (100 * values.filter((count) => count > 0).length) / values.length;
};

export const checkApiModuleCoverage = (coverage) => {
  const byModule = new Map(
    Object.entries(coverage).map(([filePath, fileCoverage]) => [
      basename(filePath),
      fileCoverage,
    ]),
  );
  const failures = [];

  for (const [module, thresholds] of Object.entries(
    protectedApiModuleThresholds,
  )) {
    const fileCoverage = byModule.get(module);
    if (!fileCoverage) {
      failures.push(`${module}: coverage entry is missing`);
      continue;
    }

    for (const metric of ["statements", "branches", "functions"]) {
      const key = coverageKeys[metric];
      if (!(key in fileCoverage)) {
        failures.push(`${module} ${metric}: coverage metric is missing`);
        continue;
      }
      const actual = percentage(Object.values(fileCoverage[key]));
      if (actual < thresholds[metric]) {
        failures.push(
          `${module} ${metric}: ${actual.toFixed(2)}% is below ${thresholds[metric]}%`,
        );
      }
    }
  }

  return failures;
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const coveragePath = resolve(
    process.cwd(),
    process.argv[2] ?? "packages/api/coverage/coverage-final.json",
  );
  const coverage = JSON.parse(await readFile(coveragePath, "utf8"));
  const failures = checkApiModuleCoverage(coverage);
  if (failures.length > 0) {
    console.error("API module coverage failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(
      `API module coverage passed (${Object.keys(protectedApiModuleThresholds).length} protected modules).`,
    );
  }
}
