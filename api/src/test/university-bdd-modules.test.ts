import { describe, expect, it } from "vitest";

import * as facade from "../university-bdd";
import * as artifacts from "../university-bdd-artifacts";
import * as engine from "../university-bdd-engine";
import * as fixtures from "../university-bdd-fixtures";
import * as contracts from "../university-bdd-types";

const sortedRuntimeExports = (
  moduleExports: Record<string, unknown>,
): string[] =>
  Object.keys(moduleExports).sort((lhs, rhs) => lhs.localeCompare(rhs));

const sourceModules = {
  artifacts,
  engine,
  fixtures,
  contracts,
} as const;

describe("University BDD module boundaries", () => {
  it("keeps the public facade wired to the scenario engine", () => {
    expect(facade.runUniversityDiplomaScenario).toBe(
      engine.runUniversityDiplomaScenario,
    );
    expect(facade.loadUniversityScenarioFromFile).toBe(
      fixtures.loadUniversityScenarioFromFile,
    );
    expect(facade.generateUniversityFixture).toBe(
      fixtures.generateUniversityFixture,
    );
    expect(facade.toUniversityScenarioArtifact).toBe(
      artifacts.toUniversityScenarioArtifact,
    );
    expect(facade.toUniversityScenarioReplayArtifact).toBe(
      artifacts.toUniversityScenarioReplayArtifact,
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
      ...new Set(Object.values(sourceModules).flatMap(sortedRuntimeExports)),
    ].sort((lhs, rhs) => lhs.localeCompare(rhs));

    expect(sortedRuntimeExports(facade)).toEqual(expectedExports);
  });

  it("keeps runtime export names disjoint across source modules", () => {
    const seen = new Map<string, string>();
    const collisions: string[] = [];

    for (const [moduleName, moduleExports] of Object.entries(sourceModules)) {
      for (const exportName of sortedRuntimeExports(moduleExports)) {
        const existingModule = seen.get(exportName);
        if (existingModule != null) {
          collisions.push(`${exportName}: ${existingModule}, ${moduleName}`);
          continue;
        }

        seen.set(exportName, moduleName);
      }
    }

    expect(collisions).toEqual([]);
  });

  it("exposes readonly DID namespace prefix sets", () => {
    const namespaceSets = [
      ...Object.values(facade.UNIVERSITY_DID_NAMESPACE_PREFIXES),
      facade.UNIVERSITY_DID_TRUST_EVENT_NAMESPACE_PREFIXES,
    ];

    for (const prefixes of namespaceSets) {
      const mutablePrefixes = prefixes as Set<string>;

      expect(prefixes.size).toBeGreaterThan(0);
      expect(() => mutablePrefixes.add("did:midnight:evil")).toThrow(
        /readonly/,
      );
      expect(() => mutablePrefixes.delete("did:midnight:user")).toThrow(
        /readonly/,
      );
      expect(() => mutablePrefixes.clear()).toThrow(/readonly/);
      expect(prefixes.has("did:midnight:evil")).toBe(false);
    }
  });
});
