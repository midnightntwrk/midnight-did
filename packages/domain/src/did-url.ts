const URI_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/u;

const splitDIDSubject = (value: string): string => {
  const boundary = value.search(/[/?#]/u);
  return boundary === -1 ? value : value.slice(0, boundary);
};

const removeDotSegments = (path: string): string => {
  const output: string[] = [];
  for (const segment of path.split("/")) {
    if (segment === ".") continue;
    if (segment === "..") {
      // Keep the leading empty segment that represents the root path, while
      // preserving duplicate slashes and trailing slashes verbatim.
      if (output.length > 1) output.pop();
      continue;
    }
    output.push(segment);
  }
  const normalized = output.join("/");
  return normalized.length === 0 ? "/" : normalized;
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
      if (
        !options.allowExternalDID &&
        subject.toLowerCase() !== did.toLowerCase()
      ) {
        throw new Error(`DID URL subject must match the current DID (${did})`);
      }
      const canonicalSubject =
        subject.toLowerCase() === did.toLowerCase() ? did : subject;
      return `${canonicalSubject}${value.slice(subject.length)}`;
    }

    try {
      return new URL(value).href;
    } catch {
      throw new Error("DID URL reference must be an absolute URL");
    }
  }

  return resolveRelativeDIDURL(did, value);
};
