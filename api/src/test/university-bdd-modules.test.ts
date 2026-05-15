import { describe, expect, it } from "vitest";

import * as facade from "../university-bdd";
import * as engine from "../university-bdd-engine";
import * as contracts from "../university-bdd-types";

const sortedRuntimeExports = (
  moduleExports: Record<string, unknown>,
): string[] =>
  Object.keys(moduleExports).sort((lhs, rhs) => lhs.localeCompare(rhs));

describe("University BDD module boundaries", () => {
  it("keeps the public facade wired to the scenario engine", () => {
    expect(facade.runUniversityDiplomaScenario).toBe(
      engine.runUniversityDiplomaScenario,
    );
    expect(facade.loadUniversityScenarioFromFile).toBe(
      engine.loadUniversityScenarioFromFile,
    );
    expect(facade.toUniversityScenarioArtifact).toBe(
      engine.toUniversityScenarioArtifact,
    );
    expect(facade.toUniversityScenarioReplayArtifact).toBe(
      engine.toUniversityScenarioReplayArtifact,
    );
  });

  it("exposes contract constants from the dedicated types module", () => {
    expect(facade.UNIVERSITY_SCENARIO_REPORT_ARTIFACT_VERSION).toBe(
      contracts.UNIVERSITY_SCENARIO_REPORT_ARTIFACT_VERSION,
    );
    expect(facade.UNIVERSITY_SCENARIO_REPLAY_ARTIFACT_VERSION).toBe(
      contracts.UNIVERSITY_SCENARIO_REPLAY_ARTIFACT_VERSION,
    );
    expect(facade.UNIVERSITY_DID_METHOD_PATTERN).toBe(
      contracts.UNIVERSITY_DID_METHOD_PATTERN,
    );
    expect(facade.UNIVERSITY_DID_NAMESPACE_PREFIXES).toBe(
      contracts.UNIVERSITY_DID_NAMESPACE_PREFIXES,
    );
  });

  it("keeps the facade as a pure re-export surface", () => {
    const expectedExports = [
      ...new Set([
        ...sortedRuntimeExports(engine),
        ...sortedRuntimeExports(contracts),
      ]),
    ].sort((lhs, rhs) => lhs.localeCompare(rhs));

    expect(sortedRuntimeExports(facade)).toEqual(expectedExports);
  });
});
