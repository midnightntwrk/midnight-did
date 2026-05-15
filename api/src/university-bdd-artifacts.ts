import {
  UNIVERSITY_SCENARIO_REPLAY_ARTIFACT_VERSION,
  UNIVERSITY_SCENARIO_REPORT_ARTIFACT_VERSION,
  type UniversityDiscountStepResponse,
  type UniversityIssuanceStepResponse,
  type UniversityPartySamples,
  type UniversityPresentationStepResponse,
  type UniversityScenarioReplayArtifact,
  type UniversityScenarioReportArtifact,
  type UniversityScenarioResult,
  type UniversityTransportMode,
} from "./university-bdd-types";
import {
  assertRequiredNumber,
  assertRequiredString,
} from "./university-bdd-utils";

const asMarkdownBlock = (value: unknown): string =>
  JSON.stringify(value, null, 2).replace(/^/gm, "  ");

const assertArtifactObject = (
  value: unknown,
  label: string,
): Record<string, unknown> => {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid university artifact format: ${label}`);
  }

  return value as Record<string, unknown>;
};

const assertArtifactString = (value: unknown, label: string): string =>
  assertRequiredString(value, label, true, "artifact");

const assertArtifactNumber = (value: unknown, label: string): number =>
  assertRequiredNumber(value, label, "artifact");

const toArtifactVersion = (value: unknown, fallback: string): string => {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }
  return fallback;
};

export const normalizeUniversityScenarioReportArtifact = (
  raw: unknown,
): UniversityScenarioReportArtifact => {
  const artifact = assertArtifactObject(raw, "report artifact");
  const metadata = assertArtifactObject(artifact.metadata, "metadata");
  const timing = assertArtifactObject(artifact.timing, "timing");

  return {
    artifactVersion: toArtifactVersion(
      artifact.artifactVersion,
      UNIVERSITY_SCENARIO_REPORT_ARTIFACT_VERSION,
    ),
    scenarioTitle: assertArtifactString(
      artifact.scenarioTitle,
      "scenarioTitle",
    ),
    generatedAt: assertArtifactString(artifact.generatedAt, "generatedAt"),
    metadata: {
      mode: assertArtifactString(
        metadata.mode,
        "metadata.mode",
      ) as UniversityTransportMode,
      fixtureVersion: assertArtifactString(
        metadata.fixtureVersion,
        "metadata.fixtureVersion",
      ),
      studentsTargeted: assertArtifactNumber(
        metadata.studentsTargeted,
        "metadata.studentsTargeted",
      ),
      companiesTargeted: assertArtifactNumber(
        metadata.companiesTargeted,
        "metadata.companiesTargeted",
      ),
      totalStudents: assertArtifactNumber(
        metadata.totalStudents,
        "metadata.totalStudents",
      ),
      totalCompanies: assertArtifactNumber(
        metadata.totalCompanies,
        "metadata.totalCompanies",
      ),
    },
    timing: {
      totalSteps: assertArtifactNumber(timing.totalSteps, "timing.totalSteps"),
      totalLatencyMs: assertArtifactNumber(
        timing.totalLatencyMs,
        "timing.totalLatencyMs",
      ),
      avgLatencyMs: assertArtifactNumber(
        timing.avgLatencyMs,
        "timing.avgLatencyMs",
      ),
    },
    issuedCount: assertArtifactNumber(artifact.issuedCount, "issuedCount"),
    applicationCount: assertArtifactNumber(
      artifact.applicationCount,
      "applicationCount",
    ),
    discountCount: assertArtifactNumber(
      artifact.discountCount,
      "discountCount",
    ),
    approvedApplications: assertArtifactNumber(
      artifact.approvedApplications,
      "approvedApplications",
    ),
    approvedDiscounts: assertArtifactNumber(
      artifact.approvedDiscounts,
      "approvedDiscounts",
    ),
    steps: Array.isArray(artifact.steps)
      ? artifact.steps.map((step) => {
          const entry = assertArtifactObject(step, "step");
          return {
            step: assertArtifactString(entry.step, "step.step"),
            request: entry.request as unknown,
            response: entry.response as unknown,
            checks: Array.isArray(entry.checks)
              ? entry.checks.map((item) => assertArtifactString(item, "check"))
              : [],
            involvedDids: Array.isArray(entry.involvedDids)
              ? entry.involvedDids.map((item) =>
                  assertArtifactString(item, "did"),
                )
              : [],
            latencyMs: assertArtifactNumber(entry.latencyMs, "latencyMs"),
            stepId: assertArtifactString(entry.stepId, "stepId"),
            requestId: assertArtifactString(entry.requestId, "requestId"),
            requestHash: assertArtifactString(entry.requestHash, "requestHash"),
            responseHash: assertArtifactString(
              entry.responseHash,
              "responseHash",
            ),
            startedAt: assertArtifactString(entry.startedAt, "startedAt"),
            endedAt: assertArtifactString(entry.endedAt, "endedAt"),
            transportChecks: Array.isArray(entry.transportChecks)
              ? entry.transportChecks.map((item) =>
                  assertArtifactString(item, "transportCheck"),
                )
              : [],
            proofPlaceholders: Array.isArray(entry.proofPlaceholders)
              ? entry.proofPlaceholders.map((item) =>
                  assertArtifactString(item, "proofPlaceholder"),
                )
              : undefined,
            didBindingChecks: Array.isArray(entry.didBindingChecks)
              ? entry.didBindingChecks.map((item) =>
                  assertArtifactString(item, "didBindingCheck"),
                )
              : undefined,
          };
        })
      : [],
  };
};

export const normalizeUniversityScenarioReplayArtifact = (
  raw: unknown,
): UniversityScenarioReplayArtifact => {
  const artifact = assertArtifactObject(raw, "replay artifact");

  return {
    artifactVersion: toArtifactVersion(
      artifact.artifactVersion,
      UNIVERSITY_SCENARIO_REPLAY_ARTIFACT_VERSION,
    ),
    scenarioTitle: assertArtifactString(
      artifact.scenarioTitle,
      "scenarioTitle",
    ),
    generatedAt: assertArtifactString(artifact.generatedAt, "generatedAt"),
    mode: assertArtifactString(
      artifact.mode,
      "mode",
    ) as UniversityTransportMode,
    steps: Array.isArray(artifact.steps)
      ? artifact.steps.map((step) => {
          const entry = assertArtifactObject(step, "step");
          return {
            step: assertArtifactString(entry.step, "step.step"),
            stepId: assertArtifactString(entry.stepId, "stepId"),
            requestId: assertArtifactString(entry.requestId, "requestId"),
            requestHash: assertArtifactString(entry.requestHash, "requestHash"),
            responseHash: assertArtifactString(
              entry.responseHash,
              "responseHash",
            ),
            proofPlaceholders: Array.isArray(entry.proofPlaceholders)
              ? entry.proofPlaceholders.map((item) =>
                  assertArtifactString(item, "proofPlaceholder"),
                )
              : undefined,
            didBindingChecks: Array.isArray(entry.didBindingChecks)
              ? entry.didBindingChecks.map((item) =>
                  assertArtifactString(item, "didBindingCheck"),
                )
              : undefined,
            startedAt: assertArtifactString(entry.startedAt, "startedAt"),
            endedAt: assertArtifactString(entry.endedAt, "endedAt"),
            latencyMs: assertArtifactNumber(entry.latencyMs, "latencyMs"),
            involvedDids: Array.isArray(entry.involvedDids)
              ? entry.involvedDids.map((item) =>
                  assertArtifactString(item, "did"),
                )
              : [],
          };
        })
      : [],
  };
};

export const collectUniversityPartySamples = (
  report: UniversityScenarioResult,
): UniversityPartySamples => {
  const issueStep = report.steps.find(
    (step) => step.step === "Issue diploma VC across batches",
  )?.response as UniversityIssuanceStepResponse | undefined;

  const presentationStep = report.steps.find(
    (step) => step.step === "Student-to-verifier presentation requests",
  )?.response as UniversityPresentationStepResponse | undefined;

  const discountStep = report.steps.find(
    (step) => step.step === "Student-to-mall discount presentations",
  )?.response as UniversityDiscountStepResponse | undefined;

  const studentToUniversity = (issueStep?.issuedRequests ?? []).map(
    ({ request, response }) => ({
      senderDid: request.studentDid,
      receiverDid: request.universityDid,
      request,
      response,
    }),
  );

  const studentToVerifier = (presentationStep?.presentationResults ?? []).map(
    ({ student, credential, response, ...request }) => ({
      senderDid: request.studentDid,
      receiverDid: request.verifierDid,
      request: {
        ...request,
        student,
        credential,
      },
      response,
    }),
  );

  const studentToMall = (discountStep?.discountRequests ?? []).map(
    ({ student, credential, response, ...request }) => ({
      senderDid: request.studentDid,
      receiverDid: request.mallDid,
      request: {
        ...request,
        student,
        credential,
      },
      response,
    }),
  );

  return {
    studentToUniversity,
    studentToVerifier,
    studentToMall,
  };
};

export const formatUniversityScenarioNotes = (
  report: UniversityScenarioResult,
): string => {
  return report.steps
    .map((step) => {
      return [
        `Step: ${step.step}`,
        `Involved DIDs: ${step.involvedDids.join(", ") || "none"}`,
        "Request:",
        asMarkdownBlock(step.request),
        "Response:",
        asMarkdownBlock(step.response),
        `Checks:`,
        step.checks.map((check) => `- ${check}`).join("\n"),
      ].join("\n");
    })
    .join("\n\n");
};

export const summarizeUniversityScenario = (
  report: UniversityScenarioResult,
): string => {
  return [
    `University BDD summary for: ${report.scenarioTitle}`,
    `Mode: ${report.metadata.mode}`,
    `Executed at: ${report.generatedAt}`,
    `Students: ${report.metadata.studentsTargeted}/${report.metadata.totalStudents}`,
    `Verifiers: ${report.metadata.companiesTargeted}/${report.metadata.totalCompanies}`,
    `Issued: ${report.issuedCount}`,
    `Applications: ${report.applicationCount} (${report.approvedApplications} approved)`,
    `Discounts: ${report.discountCount} (${report.approvedDiscounts} approved)`,
    `Latency: ${report.timing.totalLatencyMs}ms over ${report.timing.totalSteps} steps`,
  ].join("\n");
};

export const toUniversityScenarioArtifact = (
  report: UniversityScenarioResult,
): UniversityScenarioReportArtifact => ({
  artifactVersion: UNIVERSITY_SCENARIO_REPORT_ARTIFACT_VERSION,
  scenarioTitle: report.scenarioTitle,
  generatedAt: report.generatedAt,
  metadata: report.metadata,
  timing: report.timing,
  issuedCount: report.issuedCount,
  applicationCount: report.applicationCount,
  discountCount: report.discountCount,
  approvedApplications: report.approvedApplications,
  approvedDiscounts: report.approvedDiscounts,
  steps: report.steps.map((step) => ({
    step: step.step,
    request: step.request,
    response: step.response,
    checks: step.checks,
    involvedDids: step.involvedDids,
    latencyMs: step.latencyMs,
    stepId: step.stepId,
    requestId: step.requestId,
    requestHash: step.requestHash,
    responseHash: step.responseHash,
    startedAt: step.startedAt,
    endedAt: step.endedAt,
  })),
});

export const toUniversityScenarioReplayArtifact = (
  report: UniversityScenarioResult,
): UniversityScenarioReplayArtifact => ({
  artifactVersion: UNIVERSITY_SCENARIO_REPLAY_ARTIFACT_VERSION,
  scenarioTitle: report.scenarioTitle,
  generatedAt: report.generatedAt,
  mode: report.metadata.mode,
  steps: report.steps.map((step) => ({
    step: step.step,
    stepId: step.stepId,
    requestId: step.requestId,
    requestHash: step.requestHash,
    responseHash: step.responseHash,
    proofPlaceholders: step.proofPlaceholders,
    didBindingChecks: step.didBindingChecks,
    startedAt: step.startedAt,
    endedAt: step.endedAt,
    latencyMs: step.latencyMs,
    involvedDids: step.involvedDids,
  })),
});
