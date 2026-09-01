import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parsePackageSpec, validateReviewPolicy } from "./diagnose.mjs";

test("parses pinned scoped and unscoped npm package specifications", () => {
  assert.deepEqual(parsePackageSpec("npm:dev-loops@0.9.0"), {
    spec: "npm:dev-loops@0.9.0",
    name: "dev-loops",
    version: "0.9.0",
  });
  assert.deepEqual(parsePackageSpec("npm:pi-subagents@0.62.0"), {
    spec: "npm:pi-subagents@0.62.0",
    name: "pi-subagents",
    version: "0.62.0",
  });
  assert.deepEqual(
    parsePackageSpec("npm:@input-output-hk/agent-review-pi@0.6.0"),
    {
      spec: "npm:@input-output-hk/agent-review-pi@0.6.0",
      name: "@input-output-hk/agent-review-pi",
      version: "0.6.0",
    },
  );
  assert.equal(parsePackageSpec("github:user/repo"), null);
});

test("keeps the reviewed stable Pi package pins exact", async () => {
  const settings = JSON.parse(
    await readFile(new URL("../../.pi/settings.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(settings.packages, [
    "npm:dev-loops@0.9.0",
    "npm:pi-subagents@0.62.0",
    "npm:@input-output-hk/agent-review-pi@0.6.0",
  ]);
});

test("review readiness fails closed when a mandatory reviewer is not routed", () => {
  const valid = {
    version: 1,
    routedReview: { backend: "agent-review", reviewers: ["patextreme"] },
    audit: {
      requiredReviewerLogins: ["patextreme"],
      structuredMarker: "agentflow-pr-review",
    },
  };
  assert.deepEqual(validateReviewPolicy(valid), { ok: true, errors: [] });
  const invalid = structuredClone(valid);
  invalid.audit.requiredReviewerLogins = ["someone-else"];
  const result = validateReviewPolicy(invalid);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("; "), /must be routed/);
});
