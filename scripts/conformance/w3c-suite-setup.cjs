"use strict";

const fs = require("fs");

const fixturePath = process.env.W3C_SUITE_FIXTURE;
const suite = process.env.W3C_CURRENT_SUITE;
if (!fixturePath || !suite) {
  throw new Error("W3C_SUITE_FIXTURE and W3C_CURRENT_SUITE are required");
}
global.systemSuiteConfig = {
  didMethods: [JSON.parse(fs.readFileSync(fixturePath, "utf8"))],
  name: `midnight-${suite}`,
  suite_name: suite,
};
