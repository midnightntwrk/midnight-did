import assert from "node:assert/strict";
import test from "node:test";

import { parsePackageSpec, validateReviewPolicy } from "./diagnose.mjs";

test("parses pinned scoped and unscoped npm package specifications", () => {
  assert.deepEqual(parsePackageSpec("npm:dev-loops@0.9.0"), {
    spec: "npm:dev-loops@0.9.0",
    name: "dev-loops",
    version: "0.9.0",
  });
  assert.deepEqual(
    parsePackageSpec("npm:@input-output-hk/agent-review-pi@0.5.0"),
    {
      spec: "npm:@input-output-hk/agent-review-pi@0.5.0",
      name: "@input-output-hk/agent-review-pi",
      version: "0.5.0",
    },
  );
  assert.equal(parsePackageSpec("github:user/repo"), null);
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
