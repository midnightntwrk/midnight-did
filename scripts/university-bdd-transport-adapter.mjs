#!/usr/bin/env node

const mapTransportError = (operation, cause) => {
  if (cause instanceof UniversityTransportAdapterError) {
    return cause;
  }

  const baseMessage =
    cause instanceof Error ? cause.message : String(cause);

  return new UniversityTransportAdapterError(
    operation,
    `Transport operation failed: ${operation}: ${baseMessage}`,
    cause,
  );
};

export class UniversityTransportAdapterError extends Error {
  /** @param {string} operation */
  /** @param {string} message */
  /** @param {unknown} cause */
  constructor(operation, message, cause) {
    super(message);
    this.name = "UniversityTransportAdapterError";
    this.operation = operation;
    this.cause = cause;
  }
}

const normalizeEndpointPath = (value) => {
  if (value.startsWith("/")) {
    return value;
  }
  return `/${value}`;
};

const safeJson = async (response) => {
  try {
    const payload = await response.text();
    if (payload.trim() === "") {
      return {};
    }

    return JSON.parse(payload);
  } catch {
    return {};
  }
};

const postJsonTransport = async ({
  baseUrl,
  operation,
  path,
  request,
  timeoutMs,
  fetchFn,
}) => {
  const url = new URL(normalizeEndpointPath(path), baseUrl);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetchFn(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const payload = await safeJson(response);
      const details =
        typeof payload === "string"
          ? payload
          : payload == null
            ? ""
            : payload.error ?? JSON.stringify(payload);
      throw mapTransportError(
        operation,
        new Error(
          `HTTP ${response.status} ${response.statusText}${
            details ? `: ${details}` : ""
          }`,
        ),
      );
    }

    return response.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw mapTransportError(
        operation,
        new Error(`Request timeout (${timeoutMs}ms)`),
      );
    }
    throw mapTransportError(operation, error);
  } finally {
    if (timeout != null) {
      clearTimeout(timeout);
    }
  }
};

export const createHttpUniversityTransport = ({
  baseUrl,
  timeoutMs = 5_000,
  paths = {
    issueDiploma: "/issue",
    requestPresentation: "/present",
    requestDiscount: "/discount",
  },
  fetchFn = globalThis.fetch,
}) => {
  if (typeof baseUrl !== "string" || baseUrl.trim() === "") {
    throw new Error("Transport configuration must include baseUrl");
  }

  if (typeof fetchFn !== "function") {
    throw new Error("Transport fetchFn must be a function");
  }

  return {
    issueDiploma(request) {
      return postJsonTransport({
        baseUrl,
        operation: "issueDiploma",
        path: paths.issueDiploma,
        request,
        timeoutMs,
        fetchFn,
      });
    },
    requestPresentation(request) {
      return postJsonTransport({
        baseUrl,
        operation: "requestPresentation",
        path: paths.requestPresentation,
        request,
        timeoutMs,
        fetchFn,
      });
    },
    requestDiscount(request) {
      return postJsonTransport({
        baseUrl,
        operation: "requestDiscount",
        path: paths.requestDiscount,
        request,
        timeoutMs,
        fetchFn,
      });
    },
  };
};

export const createGrpcUniversityTransport = ({ invoke } = {}) => {
  if (typeof invoke !== "function") {
    return {
      issueDiploma() {
        throw new UniversityTransportAdapterError(
          "issueDiploma",
          "gRPC transport stub is not configured: provide an invoke handler",
          new Error("No gRPC invoke configured"),
        );
      },
      requestPresentation() {
        throw new UniversityTransportAdapterError(
          "requestPresentation",
          "gRPC transport stub is not configured: provide an invoke handler",
          new Error("No gRPC invoke configured"),
        );
      },
      requestDiscount() {
        throw new UniversityTransportAdapterError(
          "requestDiscount",
          "gRPC transport stub is not configured: provide an invoke handler",
          new Error("No gRPC invoke configured"),
        );
      },
    };
  }

  return {
    issueDiploma(request) {
      return invoke("issueDiploma", request).catch((error) => {
        throw mapTransportError("issueDiploma", error);
      });
    },
    requestPresentation(request) {
      return invoke("requestPresentation", request).catch((error) => {
        throw mapTransportError("requestPresentation", error);
      });
    },
    requestDiscount(request) {
      return invoke("requestDiscount", request).catch((error) => {
        throw mapTransportError("requestDiscount", error);
      });
    },
  };
};

export const createUniversityTransportAdapter = (options = {}) => {
  const normalizedMode = String(options.mode || "http").toLowerCase();
  if (normalizedMode !== "http" && normalizedMode !== "grpc") {
    throw new Error(
      `Unknown transport mode: ${options.mode}. Expected http or grpc.`,
    );
  }

  if (normalizedMode === "http") {
    if (options.config == null) {
      throw new Error(
        "HTTP transport configuration is required when mode=http",
      );
    }
    return createHttpUniversityTransport(options.config);
  }

  return createGrpcUniversityTransport(options.config);
};

const printTransportHealth = (transport) => {
  const required = ["issueDiploma", "requestPresentation", "requestDiscount"];
  const missing = required.filter((method) => typeof transport?.[method] !== "function");
  if (missing.length > 0) {
    throw new Error(
      `Transport missing methods: ${missing.join(", ")} (expected: ${required.join(", ")})`,
    );
  }
};

export const assertTransportConforms = (transport) => {
  if (transport == null || typeof transport !== "object") {
    throw new Error("Transport must be an object");
  }

  printTransportHealth(transport);
};
