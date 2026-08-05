import assert from "node:assert/strict";
import test from "node:test";

import {
  checkApiModuleCoverage,
  protectedApiModuleThresholds,
} from "./check-api-module-coverage.mjs";

const completeCoverage = (overrides = {}) =>
  Object.fromEntries(
    Object.keys(protectedApiModuleThresholds).map((module) => [
      `/workspace/packages/api/src/${module}`,
      {
        s: Object.fromEntries(
          Array.from({ length: 10 }, (_, index) => [index, 1]),
        ),
        b: Object.fromEntries(
          Array.from({ length: 10 }, (_, index) => [index, [1, 1]]),
        ),
        f: Object.fromEntries(
          Array.from({ length: 10 }, (_, index) => [index, 1]),
        ),
        ...overrides[module],
      },
    ]),
  );

test("passes when every protected module meets its threshold", () => {
  assert.deepEqual(checkApiModuleCoverage(completeCoverage()), []);
});

test("reports missing protected modules and threshold failures", () => {
  const coverage = completeCoverage();
  delete coverage["/workspace/packages/api/src/wallet-keys.ts"];
  coverage["/workspace/packages/api/src/service-operations.ts"].s = {
    0: 1,
    1: 0,
  };
  delete coverage["/workspace/packages/api/src/controller-authorization.ts"].f;

  assert.deepEqual(checkApiModuleCoverage(coverage), [
    "controller-authorization.ts functions: coverage metric is missing",
    "service-operations.ts statements: 50.00% is below 90%",
    "wallet-keys.ts: coverage entry is missing",
  ]);
});
