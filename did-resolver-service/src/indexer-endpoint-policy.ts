import { type ResolveRequestOptions } from "./types.js";

export type IndexerEndpoints = {
  indexerHttpUrl: string;
  indexerWsUrl: string;
};

export class IndexerEndpointPolicy {
  private readonly defaultIndexerHttpUrl: string;
  private readonly defaultIndexerWsUrl: string;

  constructor(defaultEndpoints: IndexerEndpoints) {
    this.defaultIndexerHttpUrl = defaultEndpoints.indexerHttpUrl;
    this.defaultIndexerWsUrl = defaultEndpoints.indexerWsUrl;
  }

  private static normalizeUrl(
    value: string,
    protocols: readonly string[],
    message: string,
  ): string {
    const trimmed = value.trim();
    const parsed = new URL(trimmed);
    if (!protocols.includes(parsed.protocol)) {
      throw new Error(message);
    }
    return parsed.toString().replace(/\/+$/, "");
  }

  private static normalizeIndexerHttpUrl(value: string): string {
    return IndexerEndpointPolicy.normalizeUrl(
      value,
      ["http:", "https:"],
      "indexerUrl must use http or https",
    );
  }

  private static normalizeIndexerWsUrl(value: string): string {
    return IndexerEndpointPolicy.normalizeUrl(
      value,
      ["ws:", "wss:"],
      "indexerWsUrl must use ws or wss",
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
    return { indexerHttpUrl, indexerWsUrl };
  }
}
