import path from "node:path";

import {
  DockerComposeEnvironment,
  type StartedDockerComposeEnvironment,
  Wait,
} from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupComposeProject,
  waitForMappedPort,
} from "./docker-compose-utils.js";

const resolverDir = path.resolve(
  new URL(import.meta.url).pathname,
  "../../../..",
);

let containerRuntimeAvailable = true;
let _containerRuntimeError: string | undefined;
try {
  const { getContainerRuntimeClient } = await import(
    "testcontainers/build/container-runtime/clients/client.js"
  );
  await getContainerRuntimeClient();
} catch (error) {
  containerRuntimeAvailable = false;
  _containerRuntimeError =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : undefined;
}

const describeIntegration = containerRuntimeAvailable
  ? describe
  : describe.skip;

describeIntegration("did-resolver-service docker integration", () => {
  let env: StartedDockerComposeEnvironment;
  let projectName = "";
  let baseUrl = process.env.RESOLVER_TEST_BASE_URL;
  const printResolverHint = () => {
    if (!baseUrl) return;
    console.info(
      `[resolver-integration] UI: ${baseUrl}/\n` +
        `[resolver-integration] Example invalid DID check: ${baseUrl}/resolve/not-a-did`,
    );
  };

  beforeAll(async () => {
    projectName = `did-resolver-int-${Date.now()}`;
    const dockerEnv = new DockerComposeEnvironment(
      resolverDir,
      "compose.integration.yml",
    )
      .withProjectName(projectName)
      .withWaitStrategy("did-resolver", Wait.forHttp("/health", 3001));

    env = await dockerEnv.up();
    if (!baseUrl) {
      const resolverPort = await waitForMappedPort(env, {
        cwd: resolverDir,
        composeFile: "compose.integration.yml",
        projectName,
        serviceName: "did-resolver",
        internalPort: 3001,
      });
      baseUrl = `http://127.0.0.1:${resolverPort}`;
    }
    printResolverHint();
  });

  afterAll(async () => {
    try {
      if (env !== undefined) {
        await env.down({ removeVolumes: true, timeout: 30 });
      }
    } finally {
      cleanupComposeProject({
        cwd: resolverDir,
        composeFile: "compose.integration.yml",
        projectName,
      });
    }
  });

  it("serves health endpoint from container image", async () => {
    if (!baseUrl) throw new Error("Resolver base URL is not configured");
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("returns invalidDid for malformed DID request", async () => {
    if (!baseUrl) throw new Error("Resolver base URL is not configured");
    const response = await fetch(`${baseUrl}/resolve/not-a-did`);
    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      didResolutionMetadata: { error: string };
    };
    expect(body.didResolutionMetadata.error).toBe("invalidDid");
  });

  it("exposes Swagger UI route", async () => {
    if (!baseUrl) throw new Error("Resolver base URL is not configured");
    const response = await fetch(`${baseUrl}/docs`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type") ?? "").toContain("text/html");
  });
});
