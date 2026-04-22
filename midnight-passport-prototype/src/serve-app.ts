import { Buffer } from "node:buffer";
import { error as logError, log } from "node:console";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { extname, join, normalize, relative, resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

import {
  isPassportPrototypeAction,
  PassportPrototypeSession,
} from "./app-session.js";
import type { NationalIdIssuerCheck } from "./issuers/national-id-issuer-service.js";
import type { ScreeningIssuerCheck } from "./issuers/screening-issuer-service.js";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "5174", 10);
const appRoot = resolve(fileURLToPath(new URL("../app", import.meta.url)));
let session = new PassportPrototypeSession();

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

type ErrnoError = Error & { code?: string };

const sendText = (
  response: ServerResponse,
  status: number,
  message: string,
): void => {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  response.end(`${message}\n`);
};

const sendJson = (
  response: ServerResponse,
  status: number,
  value: unknown,
): void => {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(`${JSON.stringify(value, null, 2)}\n`);
};

const readJsonBody = async (request: IncomingMessage): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Invalid JSON body"));
      }
    });
    request.on("error", reject);
  });

const originFor = (requestUrl: URL): string => requestUrl.origin;

const handleNationalIdIssuerApi = async (
  request: IncomingMessage,
  requestUrl: URL,
  response: ServerResponse,
): Promise<boolean> => {
  const issuer = session.nationalIdIssuerApi();
  const origin = originFor(requestUrl);

  if (requestUrl.pathname === "/api/issuer/national-id/metadata") {
    sendJson(response, 200, issuer.metadata(origin));
    return true;
  }

  if (requestUrl.pathname === "/api/issuer/national-id/start") {
    const result = session.beginNationalIdIssuance({
      issuerOrigin: origin,
      redirectUri: `${origin}/`,
    });
    sendJson(response, 200, result);
    return true;
  }

  if (requestUrl.pathname === "/api/issuer/national-id/redeem") {
    const body = (await readJsonBody(request)) as {
      readonly credentialOfferUri?: string;
      readonly issuerSessionId?: string;
      readonly state?: string;
    };
    if (!body.credentialOfferUri) {
      sendJson(response, 400, { error: "credentialOfferUri is required" });
      return true;
    }
    sendJson(
      response,
      200,
      session.redeemNationalIdCredentialOffer({
        credentialOfferUri: body.credentialOfferUri,
        issuerSessionId: body.issuerSessionId,
        state: body.state,
      }),
    );
    return true;
  }

  if (requestUrl.pathname === "/api/issuer/national-id/token") {
    sendJson(
      response,
      200,
      issuer.exchangeToken((await readJsonBody(request)) as never),
    );
    return true;
  }

  if (requestUrl.pathname === "/api/issuer/national-id/credential") {
    const body = (await readJsonBody(request)) as {
      readonly accessToken?: string;
      readonly credentialRequest?: unknown;
    };
    if (!body.accessToken || !body.credentialRequest) {
      sendJson(response, 400, {
        error: "accessToken and credentialRequest are required",
      });
      return true;
    }
    sendJson(
      response,
      200,
      session.issueNationalIdCredentialFromProtocol({
        accessToken: body.accessToken,
        credentialRequest: body.credentialRequest as never,
      }),
    );
    return true;
  }

  const sessionMatch = requestUrl.pathname.match(
    /^\/api\/issuer\/national-id\/sessions\/([^/]+)(?:\/checks\/([^/]+)|\/complete)?$/u,
  );
  if (!sessionMatch) {
    return false;
  }

  const [, sessionId, check] = sessionMatch;
  try {
    if (check) {
      sendJson(
        response,
        200,
        issuer.setCheck({
          sessionId,
          check: check as NationalIdIssuerCheck,
          value: true,
        }),
      );
      return true;
    }

    if (requestUrl.pathname.endsWith("/complete")) {
      sendJson(response, 200, issuer.completeChecks(sessionId));
      return true;
    }

    sendJson(response, 200, issuer.getSession(sessionId));
  } catch (error) {
    sendJson(response, 409, {
      error: error instanceof Error ? error.message : "Issuer request failed",
    });
  }
  return true;
};

const handleScreeningIssuerApi = async (
  request: IncomingMessage,
  requestUrl: URL,
  response: ServerResponse,
): Promise<boolean> => {
  const issuer = session.screeningIssuerApi();
  const origin = originFor(requestUrl);

  if (requestUrl.pathname === "/api/issuer/screening/metadata") {
    sendJson(response, 200, issuer.metadata(origin));
    return true;
  }

  if (requestUrl.pathname === "/api/issuer/screening/start") {
    const result = session.beginScreeningIssuance({
      issuerOrigin: origin,
      redirectUri: `${origin}/`,
    });
    sendJson(response, 200, result);
    return true;
  }

  if (requestUrl.pathname === "/api/issuer/screening/redeem") {
    const body = (await readJsonBody(request)) as {
      readonly credentialOfferUri?: string;
      readonly issuerSessionId?: string;
      readonly state?: string;
    };
    if (!body.credentialOfferUri) {
      sendJson(response, 400, { error: "credentialOfferUri is required" });
      return true;
    }
    sendJson(
      response,
      200,
      session.redeemScreeningCredentialOffer({
        credentialOfferUri: body.credentialOfferUri,
        issuerSessionId: body.issuerSessionId,
        state: body.state,
      }),
    );
    return true;
  }

  if (requestUrl.pathname === "/api/issuer/screening/token") {
    sendJson(
      response,
      200,
      issuer.exchangeToken((await readJsonBody(request)) as never),
    );
    return true;
  }

  if (requestUrl.pathname === "/api/issuer/screening/credential") {
    const body = (await readJsonBody(request)) as {
      readonly accessToken?: string;
      readonly credentialRequest?: unknown;
    };
    if (!body.accessToken || !body.credentialRequest) {
      sendJson(response, 400, {
        error: "accessToken and credentialRequest are required",
      });
      return true;
    }
    sendJson(
      response,
      200,
      session.issueComplianceCredentialFromProtocol({
        accessToken: body.accessToken,
        credentialRequest: body.credentialRequest as never,
      }),
    );
    return true;
  }

  const sessionMatch = requestUrl.pathname.match(
    /^\/api\/issuer\/screening\/sessions\/([^/]+)(?:\/checks\/([^/]+)|\/complete)?$/u,
  );
  if (!sessionMatch) {
    return false;
  }

  const [, sessionId, check] = sessionMatch;
  try {
    if (check) {
      sendJson(
        response,
        200,
        issuer.setCheck({
          sessionId,
          check: check as ScreeningIssuerCheck,
          value: true,
        }),
      );
      return true;
    }

    if (requestUrl.pathname.endsWith("/complete")) {
      sendJson(response, 200, issuer.completeChecks(sessionId));
      return true;
    }

    sendJson(response, 200, issuer.getSession(sessionId));
  } catch (error) {
    sendJson(response, 409, {
      error: error instanceof Error ? error.message : "Issuer request failed",
    });
  }
  return true;
};

const handleApiRequest = async (
  request: IncomingMessage,
  requestUrl: URL,
  response: ServerResponse,
): Promise<boolean> => {
  if (requestUrl.pathname === "/api/state") {
    sendJson(response, 200, session.state());
    return true;
  }

  if (requestUrl.pathname.startsWith("/api/issuer/national-id/")) {
    return handleNationalIdIssuerApi(request, requestUrl, response);
  }

  if (requestUrl.pathname.startsWith("/api/issuer/screening/")) {
    return handleScreeningIssuerApi(request, requestUrl, response);
  }

  if (requestUrl.pathname.startsWith("/api/actions/")) {
    const action = requestUrl.pathname.slice("/api/actions/".length);
    if (!isPassportPrototypeAction(action)) {
      sendJson(response, 404, {
        error: `Unknown prototype action "${action}"`,
      });
      return true;
    }

    try {
      if (action === "reset") {
        session = new PassportPrototypeSession();
        sendJson(response, 200, session.state());
        return true;
      }

      sendJson(response, 200, session.execute(action));
    } catch (error) {
      sendJson(response, 409, {
        error:
          error instanceof Error ? error.message : "Prototype action failed",
        state: session.state(),
      });
    }
    return true;
  }

  return false;
};

const filePathFromRequest = (requestUrl?: string): string | undefined => {
  const parsed = new URL(requestUrl ?? "/", `http://${host}:${port}`);
  const pathname = decodeURIComponent(parsed.pathname);
  const normalizedPath = normalize(pathname).replace(/^([/\\])+/, "");
  const requestedPath = normalizedPath === "" ? "index.html" : normalizedPath;
  const candidate = resolve(join(appRoot, requestedPath));
  const rel = relative(appRoot, candidate);

  if (rel.startsWith("..") || rel === ".." || rel.includes(`..${sep}`)) {
    return undefined;
  }

  return candidate;
};

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${host}:${port}`);

  if (requestUrl.pathname.startsWith("/api/")) {
    if (request.method !== "GET" && request.method !== "POST") {
      response.writeHead(405, { allow: "GET, POST" });
      response.end();
      return;
    }
    if (!(await handleApiRequest(request, requestUrl, response))) {
      sendJson(response, 404, { error: "API route not found" });
    }
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { allow: "GET, HEAD" });
    response.end();
    return;
  }

  const filePath = filePathFromRequest(request.url);
  if (!filePath) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      sendText(response, 404, "Not found");
      return;
    }

    response.writeHead(200, {
      "content-length": fileStat.size,
      "content-type":
        contentTypes[extname(filePath)] ?? "application/octet-stream",
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch (error) {
    if ((error as ErrnoError).code === "ENOENT") {
      sendText(response, 404, "Not found");
      return;
    }
    logError("[passport-prototype] Static server failed", error);
    sendText(response, 500, "Internal server error");
  }
});

server.listen(port, host, () => {
  log(`[passport-prototype] Serving ${appRoot}`);
  log(`[passport-prototype] Open http://${host}:${port}`);
});
