import { strict as assert } from "node:assert";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

import {
  assertTransportConforms,
  createGrpcUniversityTransport,
  createHttpUniversityTransport,
} from "./university-bdd-transport-adapter.mjs";

const parseBody = (request) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(
          chunks.length === 0
            ? {}
            : JSON.parse(Buffer.concat(chunks).toString("utf8")),
        );
      } catch {
        reject(new Error("Invalid JSON payload"));
      }
    });
  });

const runHttpServer = async (handlers) => {
  const server = createServer(async (req, res) => {
    const method = req.method?.toUpperCase();
    if (method !== "POST") {
      res.statusCode = 405;
      res.end("method-not-allowed");
      return;
    }

    let body;
    try {
      body = await parseBody(req);
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "invalid-json" }));
      return;
    }

    const route = handlers[req.url ?? ""]?.(body);
    if (route == null) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "not-found" }));
      return;
    }
    const [status, payload, delayMs] = route;
    if (delayMs != null) {
      await delay(delayMs);
    }

    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(payload));
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  if (typeof port !== "number") {
    throw new Error("Invalid server address");
  }
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
    },
  };
};

const fixtureRequest = {
  studentId: "S-001",
  studentDid: "did:midnight:user:student-001",
  universityDid: "did:midnight:edu:university-001",
  requestReference: "request-001",
};

test("creates an HTTP transport and preserves request/response contract", async () => {
  const server = await runHttpServer({
    "/issue": () => [
      200,
      {
        issued: true,
        credential: {
          id: "cred-001",
          studentId: "S-001",
          holderDid: "did:midnight:user:student-001",
          issuerDid: "did:midnight:edu:university-001",
          issuedAt: "2026-05-14T00:00:00.000Z",
          graduationTerm: "2026-Fall",
          grade: 95,
          program: "Engineering",
          credentialStatus: {
            id: "status:001",
            type: "MidnightStatusList",
            statusPurpose: "revocation",
            statusRef: "urn:vc-status:001",
          },
          proofDigest: "digest-001",
        },
        statusState: "active",
        statusReason: "status ok",
      },
    ],
    "/present": () => [
      200,
      {
        accepted: true,
        reasons: ["mock-checks", "ok"],
        issuerCheck: "issuer-ok",
      },
    ],
    "/discount": () => [
      200,
      {
        accepted: false,
        reasons: ["grade-threshold-missed"],
      },
    ],
  });

  const transport = createHttpUniversityTransport({ baseUrl: server.baseUrl });
  assertTransportConforms(transport);

  const issue = await transport.issueDiploma(fixtureRequest);
  assert.equal(issue.issued, true);
  assert.equal(issue.statusState, "active");

  const present = await transport.requestPresentation({
    ...fixtureRequest,
    presentationId: "presentation-001",
    applicationId: "app-001",
    verifierDid: "did:midnight:org:verifier-001",
    credentialId: "cred-001",
    threshold: 80,
  });
  assert.equal(present.accepted, true);

  const discount = await transport.requestDiscount({
    ...fixtureRequest,
    offerId: "offer-001",
    mallDid: "did:midnight:org:mall-001",
    credentialId: "cred-001",
    grade: 90,
    couponPercent: 30,
    gradeThreshold: 70,
  });
  assert.equal(discount.accepted, false);

  await server.close();
});

test("maps HTTP transport failures into adapter errors", async () => {
  const server = await runHttpServer({
    "/discount": () => [
      503,
      { error: "service temporary unavailable" },
    ],
  });

  const transport = createHttpUniversityTransport({
    baseUrl: server.baseUrl,
    timeoutMs: 2_000,
    paths: {
      issueDiploma: "/missing-issue",
      requestPresentation: "/missing-present",
      requestDiscount: "/discount",
    },
  });

  assertTransportConforms(transport);

  await assert.rejects(() => transport.requestDiscount({ studentId: "S-001" }), {
    message: /Transport operation failed: requestDiscount: HTTP 503/,
  });

  await server.close();
});

test("provides stubbed gRPC transport with consistent method failures", async () => {
  const transport = createGrpcUniversityTransport();
  assertTransportConforms(transport);

  await assert.rejects(() =>
    Promise.resolve().then(() => transport.issueDiploma({ studentId: "S-001" })),
  {
    name: "UniversityTransportAdapterError",
    message: /gRPC transport stub is not configured/,
  });
});

test("maps gRPC invoke failures into adapter errors", async () => {
  const transport = createGrpcUniversityTransport({
    invoke: (method, request) => {
      if (method === "issueDiploma") {
        return Promise.reject(new Error(`downstream failure for ${request.studentId}`));
      }
      if (method === "requestPresentation") {
        return Promise.reject(new Error("transport panic"));
      }
      return Promise.reject(new Error("unhandled"));
    },
  });

  await assert.rejects(
    () =>
      Promise.resolve().then(() =>
        transport.requestPresentation({ studentId: "S-001" }),
      ),
    {
      name: "UniversityTransportAdapterError",
      message: /requestPresentation/,
    },
  );
});
