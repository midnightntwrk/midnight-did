import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  formatUniversityScenarioNotes,
  loadUniversityScenarioFromFile,
  runUniversityDiplomaScenario,
  universityScenarioFixturePath,
  type UniversityScenarioResult,
} from "../university-bdd";

describe("University diploma BDD scenario", () => {
  const fixturePath = universityScenarioFixturePath(
    "university-bdd.fixture.json",
  );

  const loadResult = async (): Promise<UniversityScenarioResult> => {
    const fixture = loadUniversityScenarioFromFile(fixturePath);
    return runUniversityDiplomaScenario(fixture);
  };

  it("runs deterministic issuance, presentation, and discount steps", async () => {
    const result = await loadResult();

    const issueStep = result.steps.find(
      (step) => step.step === "Issue diploma VC across batches",
    );
    const applicationStep = result.steps.find(
      (step) => step.step === "Student-to-verifier presentation requests",
    );
    const discountStep = result.steps.find(
      (step) => step.step === "Student-to-mall discount presentations",
    );

    expect(issueStep).toBeDefined();
    expect(applicationStep).toBeDefined();
    expect(discountStep).toBeDefined();

    expect(result.issuedCount).toBe(10);
    expect(result.applicationCount).toBe(10);
    expect(result.discountCount).toBe(5);
    expect(result.approvedApplications).toBe(9);
    expect(result.approvedDiscounts).toBe(5);
    expect(result.timing.totalSteps).toBe(4);
    expect(issueStep?.response).toMatchObject({
      totalIssued: 10,
    });
    expect(applicationStep?.response).toMatchObject({
      accepted: 9,
    });
    expect(discountStep?.response).toMatchObject({
      acceptedDiscounts: 5,
    });

    const notes = formatUniversityScenarioNotes(result);
    expect(notes).toContain('"batchCount": 3');
    expect(notes).toContain('"checks": [');
    expect(notes).toContain("Step: Issue diploma VC across batches");
  });

  it("defaults to simulator transport and surfaces standalone mode guard", async () => {
    const fixture = loadUniversityScenarioFromFile(fixturePath);
    const result = await runUniversityDiplomaScenario(fixture, {
      mode: "simulator",
    });

    expect(result.applicationCount).toBe(10);

    await expect(
      runUniversityDiplomaScenario(fixture, { mode: "standalone" }),
    ).rejects.toThrow(/Standalone transport is not implemented yet/);
  });

  const artifacts = new Set<string>();
  afterEach(() => {
    for (const artifact of artifacts) {
      rmSync(artifact, { force: true });
    }
    artifacts.clear();
  });

  it("writes BDD scenario report artifact in deterministic pretty JSON", async () => {
    const result = await loadResult();
    const tempDir = mkdtempSync(join(tmpdir(), "university-bdd-"));
    const artifactPath = join(tempDir, "university-bdd-report.json");
    artifacts.add(artifactPath);

    writeFileSync(
      artifactPath,
      JSON.stringify(
        {
          scenarioTitle: result.scenarioTitle,
          generatedAt: result.generatedAt,
          timing: result.timing,
          issuedCount: result.issuedCount,
          applicationCount: result.applicationCount,
          discountCount: result.discountCount,
          approvedApplications: result.approvedApplications,
          approvedDiscounts: result.approvedDiscounts,
          steps: result.steps,
        },
        null,
        2,
      ),
      "utf8",
    );

    const parsed = JSON.parse(readFileSync(artifactPath, "utf8"));
    expect(parsed.scenarioTitle).toContain(
      "University Diploma Issuance and Presentation",
    );
    expect(parsed.approvedDiscounts).toBe(5);
    expect(parsed.steps.length).toBe(4);
    expect(parsed.timing.totalLatencyMs).toBeGreaterThanOrEqual(0);
  });
});
