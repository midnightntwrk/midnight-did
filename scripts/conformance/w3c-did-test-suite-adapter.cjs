"use strict";

const fs = require("node:fs");
const path = require("node:path");

const sourceRoot = process.env.W3C_SUITE_SOURCE;
const setupPath = process.env.W3C_SUITE_SETUP;
const rawResultsPath = process.env.W3C_RAW_RESULTS;
const suites = JSON.parse(process.env.W3C_SELECTED_SUITES || "[]");
if (!sourceRoot || !setupPath || !rawResultsPath || suites.length === 0) {
  throw new Error(
    "W3C_SUITE_SOURCE, W3C_SUITE_SETUP, W3C_RAW_RESULTS, and W3C_SELECTED_SUITES are required",
  );
}
const serverRoot = path.join(sourceRoot, "server");
const jest = require(path.join(serverRoot, "node_modules", "jest"));
const statusNames = ["failed", "passed", "pending", "skipped", "todo"];

const run = async () => {
  const output = [];
  for (const suite of suites) {
    process.env.W3C_CURRENT_SUITE = suite;
    const { results } = await jest.runCLI(
      {
        cache: false,
        ci: true,
        json: false,
        reporters: [],
        rootDir: sourceRoot,
        roots: [path.join(serverRoot, "suites", suite)],
        runInBand: true,
        setupFiles: [setupPath],
        silent: true,
      },
      [serverRoot],
    );
    if (results.numRuntimeErrorTestSuites !== 0) {
      const messages = results.testResults
        .map((testResult) => testResult.failureMessage ?? testResult.message)
        .filter(Boolean)
        .join("\n");
      throw new Error(`Upstream suite ${suite} did not execute:\n${messages}`);
    }
    const assertions = results.testResults
      .flatMap(
        (testResult) =>
          testResult.assertionResults ?? testResult.testResults ?? [],
      )
      .map((assertion) => ({
        ancestors: assertion.ancestorTitles,
        status: assertion.status,
        title: assertion.title,
      }))
      .sort((left, right) => {
        const leftKey = [...left.ancestors, left.title].join("\u0000");
        const rightKey = [...right.ancestors, right.title].join("\u0000");
        return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
      });
    const totals = Object.fromEntries(statusNames.map((status) => [status, 0]));
    for (const assertion of assertions) {
      if (!(assertion.status in totals)) {
        throw new Error(
          `Unknown upstream assertion status: ${assertion.status}`,
        );
      }
      totals[assertion.status] += 1;
    }
    totals.total = assertions.length;
    if (
      results.numTotalTestSuites !== 1 ||
      results.numTotalTests !== totals.total ||
      results.numFailedTests !== totals.failed ||
      results.numPassedTests !== totals.passed ||
      results.numPendingTests !== totals.pending + totals.skipped ||
      results.numTodoTests !== totals.todo
    ) {
      throw new Error(
        `Upstream suite ${suite} status counters disagree with assertion statuses`,
      );
    }
    output.push({ assertions, name: suite, totals });
  }
  fs.writeFileSync(rawResultsPath, `${JSON.stringify(output)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
};

run().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
