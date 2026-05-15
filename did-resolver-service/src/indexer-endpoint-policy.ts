import { ResolverInputError } from "./resolution-errors.js";
import { type ResolveRequestOptions } from "./types.js";

export type IndexerEndpoints = {
  indexerHttpUrl: string;
  indexerWsUrl: string;
};

export type IndexerEndpointAllowlist = {
  indexerHttpUrls?: readonly string[];
  indexerWsUrls?: readonly string[];
};

export const INDEXER_ENDPOINT_URL_MAX_LENGTH = 2_048;

export class IndexerEndpointPolicy {
  private readonly defaultIndexerHttpUrl: string;
  private readonly defaultIndexerWsUrl: string;
  private readonly allowedIndexerHttpUrls: ReadonlySet<string>;
  private readonly allowedIndexerWsUrls: ReadonlySet<string>;

  constructor(
    defaultEndpoints: IndexerEndpoints,
    allowlist: IndexerEndpointAllowlist = {},
  ) {
    this.defaultIndexerHttpUrl = IndexerEndpointPolicy.normalizeIndexerHttpUrl(
      defaultEndpoints.indexerHttpUrl,
    );
    this.defaultIndexerWsUrl = IndexerEndpointPolicy.normalizeIndexerWsUrl(
      defaultEndpoints.indexerWsUrl,
    );
    const allowedIndexerHttpUrls = [
      this.defaultIndexerHttpUrl,
      ...(allowlist.indexerHttpUrls ?? []).map((url) =>
        IndexerEndpointPolicy.normalizeIndexerHttpUrl(url),
      ),
    ];
    this.allowedIndexerHttpUrls = new Set(allowedIndexerHttpUrls);
    this.allowedIndexerWsUrls = new Set([
      this.defaultIndexerWsUrl,
      ...allowedIndexerHttpUrls.map((url) =>
        IndexerEndpointPolicy.deriveWsUrl(url),
      ),
      ...(allowlist.indexerWsUrls ?? []).map((url) =>
        IndexerEndpointPolicy.normalizeIndexerWsUrl(url),
      ),
    ]);
  }

  private static normalizeUrl(
    value: string,
    protocols: readonly string[],
    message: string,
    emptyMessage: string,
  ): string {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new ResolverInputError(emptyMessage);
    }
    if (trimmed.length > INDEXER_ENDPOINT_URL_MAX_LENGTH) {
      throw new ResolverInputError(
        `indexer endpoint URL must be at most ${INDEXER_ENDPOINT_URL_MAX_LENGTH.toString()} characters`,
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new ResolverInputError(message);
    }
    if (!protocols.includes(parsed.protocol)) {
      throw new ResolverInputError(message);
    }
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "");
  }

  private static normalizeIndexerHttpUrl(value: string): string {
    return IndexerEndpointPolicy.normalizeUrl(
      value,
      ["http:", "https:"],
      "indexerUrl must use http or https",
      "indexerUrl must be a non-empty URL",
    );
  }

  private static normalizeIndexerWsUrl(value: string): string {
    return IndexerEndpointPolicy.normalizeUrl(
      value,
      ["ws:", "wss:"],
      "indexerWsUrl must use ws or wss",
      "indexerWsUrl must be a non-empty URL",
    );
  }

  private static deriveWsUrl(indexerHttpUrl: string): string {
    const parsed = new URL(indexerHttpUrl);
    parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    if (parsed.pathname.endsWith("/graphql")) {
      parsed.pathname = `${parsed.pathname}/ws`;
    }
    return parsed.toString().replace(/\/+$/, "");
  }

  private assertAllowed(
    url: string,
    allowlist: ReadonlySet<string>,
    label: string,
  ): void {
    if (allowlist.has(url)) return;
    throw new ResolverInputError(
      `${label} is not in MIDNIGHT_INDEXER_ALLOWLIST`,
    );
  }

  resolve(options?: ResolveRequestOptions): IndexerEndpoints {
    const indexerHttpUrl =
      options?.indexerUrl !== undefined
        ? IndexerEndpointPolicy.normalizeIndexerHttpUrl(options.indexerUrl)
        : this.defaultIndexerHttpUrl;
    const indexerWsUrl =
      options?.indexerWsUrl !== undefined
        ? IndexerEndpointPolicy.normalizeIndexerWsUrl(options.indexerWsUrl)
        : options?.indexerUrl !== undefined
          ? IndexerEndpointPolicy.deriveWsUrl(indexerHttpUrl)
          : this.defaultIndexerWsUrl;

    if (options?.indexerUrl !== undefined) {
      this.assertAllowed(
        indexerHttpUrl,
        this.allowedIndexerHttpUrls,
        "indexerUrl",
      );
    }
    if (
      options?.indexerWsUrl !== undefined ||
      options?.indexerUrl !== undefined
    ) {
      this.assertAllowed(
        indexerWsUrl,
        this.allowedIndexerWsUrls,
        "indexerWsUrl",
      );
    }

    return { indexerHttpUrl, indexerWsUrl };
  }
}
