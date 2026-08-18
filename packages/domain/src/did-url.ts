const URI_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/u;

const splitDIDSubject = (value: string): string => {
  const boundary = value.search(/[/?#]/u);
  return boundary === -1 ? value : value.slice(0, boundary);
};

const removeDotSegments = (path: string): string => {
  let input = path;
  let output = "";
  while (input.length > 0) {
    if (input.startsWith("../")) {
      input = input.slice(3);
    } else if (input.startsWith("./")) {
      input = input.slice(2);
    } else if (input.startsWith("/./")) {
      input = `/${input.slice(3)}`;
    } else if (input === "/.") {
      input = "/";
    } else if (input.startsWith("/../")) {
      input = `/${input.slice(4)}`;
      output = output.replace(/\/[^/]*$/u, "");
    } else if (input === "/..") {
      input = "/";
      output = output.replace(/\/[^/]*$/u, "");
    } else if (input === "." || input === "..") {
      input = "";
    } else {
      const match = input.match(/^\/[^/]*|^[^/]+/u);
      if (match === null) break;
      output += match[0];
      input = input.slice(match[0].length);
    }
  }
  return output || "/";
};

const splitPathAndSuffix = (reference: string): [string, string] => {
  const suffixIndex = reference.search(/[?#]/u);
  return suffixIndex === -1
    ? [reference, ""]
    : [reference.slice(0, suffixIndex), reference.slice(suffixIndex)];
};

const resolveRelativeDIDURL = (did: string, reference: string): string => {
  if (reference.startsWith("#") || reference.startsWith("?")) {
    return `${did}${reference}`;
  }

  const [path, suffix] = splitPathAndSuffix(reference);
  const resolvedPath = removeDotSegments(
    path.startsWith("/") ? path : `/${path}`,
  );
  return `${did}${resolvedPath}${suffix}`;
};

export type DIDURLResolutionOptions = {
  /** Allow an absolute DID URL belonging to another DID subject. */
  allowExternalDID?: boolean;
  /** Accept method-specific case variations in the DID subject. */
  caseInsensitiveDIDSubject?: boolean;
};

/**
 * Resolve a DID URL or relative DID URL against a bare DID subject.
 *
 * WHATWG URL cannot resolve path/query references against an opaque `did:`
 * URL, so this intentionally implements the RFC3986 reference cases needed
 * by DID Core. The returned value is always absolute and retains path, query,
 * and fragment components.
 */
export const resolveDIDURLReference = (
  reference: string,
  did: string,
  options: DIDURLResolutionOptions = {},
): string => {
  const value = reference.trim();
  if (value.length === 0) {
    throw new Error("DID URL reference must not be empty");
  }
  if (value.startsWith("//")) {
    throw new Error("DID URL reference must not be a network-path reference");
  }

  if (URI_SCHEME.test(value)) {
    if (value.toLowerCase().startsWith("did:")) {
      const subject = splitDIDSubject(value);
      const isOffchainDID = subject
        .toLowerCase()
        .startsWith("did:midnight:offchain:");
      const subjectsMatch =
        isOffchainDID || !options.caseInsensitiveDIDSubject
          ? subject === did
          : subject.toLowerCase() === did.toLowerCase();
      if (!options.allowExternalDID && !subjectsMatch) {
        throw new Error(`DID URL subject must match the current DID (${did})`);
      }
      const canonicalSubject = subjectsMatch ? did : subject;
      const suffix = value.slice(subject.length);
      return suffix.length === 0
        ? canonicalSubject
        : resolveRelativeDIDURL(canonicalSubject, suffix);
    }

    try {
      return new URL(value).href;
    } catch {
      throw new Error("DID URL reference must be an absolute URL");
    }
  }

  return resolveRelativeDIDURL(did, value);
};
