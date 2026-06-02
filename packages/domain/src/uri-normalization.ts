// Required by the DID Core 1.0 URL normalization: https://www.rfc-editor.org/rfc/rfc3986#section-6

const KNOWN_SCHEMES = new Set(["http", "https", "ws", "wss"]);

const isDefaultPort = (protocol: string, port: string) =>
  (protocol === "http:" && port === "80") ||
  (protocol === "https:" && port === "443") ||
  (protocol === "ws:" && port === "80") ||
  (protocol === "wss:" && port === "443");

export const normalizeUriString = (value: string): string => {
  const schemeMatch = value.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (!schemeMatch) return value;
  const scheme = schemeMatch[1].toLowerCase();
  if (!KNOWN_SCHEMES.has(scheme)) return value;
  try {
    const url = new URL(value);
    const protocol = url.protocol.toLowerCase();
    const username = url.username;
    const password = url.password;
    const auth = username
      ? `${username}${password ? `:${password}` : ""}@`
      : "";
    const hostname = url.hostname.toLowerCase();
    const port =
      url.port && !isDefaultPort(protocol, url.port) ? `:${url.port}` : "";
    let pathname = url.pathname;
    const hadTrailingSlash = value.endsWith("/");
    if (!hadTrailingSlash && pathname === "/") pathname = "";
    const search = url.search;
    const hash = url.hash;
    return `${protocol}//${auth}${hostname}${port}${pathname}${search}${hash}`;
  } catch {
    return value;
  }
};

const normalizeUnknown = (value: unknown): unknown => {
  if (typeof value === "string") return normalizeUriString(value);
  if (Array.isArray(value))
    return value.map((entry) => normalizeUnknown(entry));
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(
      value as Record<string, unknown>,
    )) {
      result[key] = normalizeUnknown(entry);
    }
    return result;
  }
  return value;
};

export const normalizeServiceEndpointValue = <T>(endpoint: T): T =>
  normalizeUnknown(endpoint) as T;
